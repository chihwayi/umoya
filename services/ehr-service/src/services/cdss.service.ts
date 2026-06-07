import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { StoreroomIntelligenceService } from './storeroom-intelligence.service';
import { ClinicalNlpService, ClinicalEntities } from './clinical-nlp.service';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { config as envConfig } from '@umoya/config';
import { WhoSmartGuidelinesService, GuidelineRecommendation } from './who-smart-guidelines.service';
import { PatientConsentService } from './patient-consent.service';
import { createHash, createHmac, randomUUID } from 'crypto';
import { MetricsService } from './metrics.service';
import { HipaaAuditService } from './hipaa-audit.service';
import { CROSS_REACTIVITY_MAP, DRUG_CLASS_MEMBERS, CrossReactivityEntry } from '../config/allergy-cross-reactivity';

export interface AllergyWarning {
  severity: 'low' | 'moderate' | 'high';
  allergen: string;
  medication: string;
  crossReactivity: boolean;
  message: string;
}

export interface PatientAdherenceAssistantResponse {
  reply: string;
  intent: 'adherence_check' | 'side_effect' | 'refill_request' | 'cost_barrier' | 'general' | 'urgent';
  adherenceConcern: boolean;
  requiresClinicianFollowUp: boolean;
  urgency: 'routine' | 'urgent';
  confidence: number;
  model: string;
  abstained: boolean;
  abstainReason?: string | null;
  reasoning?: string;
  evidence?: Array<{ source: string; section?: string; strength?: string }>;
  governance?: Record<string, any>;
}

export interface PatientSymptomCheckResponse {
  differential: Array<{ condition: string; probability: number; urgency: string; nextStep: string }>;
  triageLevel: 'emergency' | 'urgent' | 'routine' | 'self_care';
  recommendedAction: string;
  confidence: number;
  model: string;
  abstained: boolean;
  abstainReason?: string | null;
  evidence?: Array<{ source: string; section?: string; strength?: string }>;
  governance?: Record<string, any>;
}

export interface PatientSummarizationResponse {
  summary?: string;
  one_liner?: string;
  text?: string;
  clinical_summary?: string;
  active_problems?: any[];
  current_medications?: any[];
  allergies?: any[];
  last_lab_abnormalities?: any[];
  last_imaging_findings?: any[];
  model?: string;
  abstained?: boolean;
  abstain_reason?: string | null;
  governance?: Record<string, any>;
}

export interface AmbientTranscriptionStreamResponse {
  transcript: string;
  entities: {
    diagnoses: Array<{ text: string; icd?: string; confidence: number }>;
    medications: Array<{ name: string; dose?: string; route?: string }>;
    allergies: Array<{ allergen: string; reaction?: string }>;
    orders: Array<{ type: string; description: string; urgency?: string }>;
    vitals: Array<{ type: string; value: string }>;
    alerts: Array<{ type: string; message: string; severity: string }>;
  };
  draftNote: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  model?: string;
  abstained?: boolean;
  abstainReason?: string | null;
  governance?: Record<string, any>;
}

export interface InboxTriageResponse {
  priority: 'critical' | 'urgent' | 'routine' | 'informational';
  priority_reason: string;
  triage_score: number;
  triage_model: string;
  due_by_hours?: number;
  draft_reply?: string;
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface RadiologyAnalysisResponse {
  findings: Array<Record<string, any>>;
  top_finding?: string;
  confidence?: number;
  heatmap_key?: string | null;
  model_version?: string;
  modality?: string;
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface PgxCheckResponse {
  drug: string;
  alerts: Array<Record<string, any>>;
  safe: boolean;
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface FormularyOptimizeResponse {
  recommendation: string;
  generic_alternative?: string;
  branded_cost?: number;
  generic_cost?: number;
  saving_amount?: number;
  evidence_equivalence?: string;
  medical_aid_coverage?: boolean;
  medical_aid_tier?: number;
  reason?: string;
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface DermatologyDecisionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface NutritionDecisionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface EducationGenerationResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface AutoCodingExtractionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface IotAnalysisResponse extends Record<string, any> {
  alerts?: Array<Record<string, any>>;
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface SchedulingPredictionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface SmartDefaultsSuggestionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface AntimicrobialDecisionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface SupplyChainPredictionResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface ModelPerformanceResponse extends Record<string, any> {
  governance?: Record<string, any>;
  abstained?: boolean;
}

export interface RegistrationDocumentAnalysisResponse {
  documentType: string;
  structuredPayload: Record<string, any>;
  summary?: string | null;
  flags?: string[];
  confidence?: number | null;
  model?: string;
  governance?: Record<string, any>;
  abstained?: boolean;
  abstainReason?: string | null;
}

export interface GovernedJsonCompletionResponse {
  json: Record<string, any>;
  model: string;
  audit?: Record<string, any>;
  governance?: Record<string, any>;
}

export interface CareGapDetectionOptions {
  tenantId?: string;
  tenantDb?: DataSource;
  patientId?: string;
  context?: string;
  specialty?: string;
  module?: string;
}

@Injectable()
export class CdssService {
  private readonly logger = new Logger(CdssService.name);
  private readonly cdssClient: AxiosInstance;
  private readonly cdssServiceUrl: string;
  private readonly cdssServiceToken?: string;
  private readonly cdssServiceJwtSecret?: string;
  private readonly cdssServiceJwtIssuer: string;
  private readonly cdssServiceJwtAudience: string;
  private readonly cdssServiceAuthMode: 'token' | 'jwt' | 'both';
  private readonly defaultTimeoutMs: number;
  private readonly retryMax: number;
  private readonly retryBaseDelayMs: number;
  private readonly circuitFailureThreshold: number;
  private readonly circuitOpenMs: number;
  private circuitState: 'closed' | 'open' | 'half_open' = 'closed';
  private circuitOpenedAt: number | null = null;
  private consecutiveFailures = 0;

  constructor(
    @Optional() @Inject(WhoSmartGuidelinesService)
    private readonly whoSmartGuidelinesService?: WhoSmartGuidelinesService,
    @Optional() @Inject(MetricsService)
    private readonly metricsService?: MetricsService,
    @Optional() @Inject(HipaaAuditService)
    private readonly hipaaAuditService?: HipaaAuditService,
    @Optional() @Inject(PatientConsentService)
    private readonly patientConsentService?: PatientConsentService,
    @Optional() private readonly clinicalNlp?: ClinicalNlpService,
    @Optional() private readonly storeroomService?: any,
    @Optional() private readonly intelligenceService?: StoreroomIntelligenceService,
  ) {
    this.cdssServiceUrl = String(process.env.CDSS_SERVICE_URL || envConfig.urls.cdssService || '').trim();
    this.cdssServiceToken = process.env.CDSS_SERVICE_TOKEN;
    this.cdssServiceJwtSecret = process.env.CDSS_SERVICE_JWT_SECRET || undefined;
    this.cdssServiceJwtIssuer = process.env.CDSS_SERVICE_AUTH_ISSUER || 'umoya.ehr-service';
    this.cdssServiceJwtAudience = process.env.CDSS_SERVICE_AUTH_AUDIENCE || 'umoya.cdss';
    const modeRaw = (process.env.CDSS_SERVICE_AUTH_MODE || 'both').toLowerCase();
    this.cdssServiceAuthMode = modeRaw === 'jwt' || modeRaw === 'token' ? modeRaw : 'both';
    this.defaultTimeoutMs = this.parsePositiveInt(process.env.CDSS_OUTBOUND_TIMEOUT_MS, 15000);
    this.retryMax = this.parsePositiveInt(process.env.CDSS_OUTBOUND_RETRY_MAX, 2);
    this.retryBaseDelayMs = this.parsePositiveInt(process.env.CDSS_OUTBOUND_RETRY_BASE_MS, 200);
    this.circuitFailureThreshold = this.parsePositiveInt(process.env.CDSS_CIRCUIT_BREAKER_FAIL_THRESHOLD, 5);
    this.circuitOpenMs = this.parsePositiveInt(process.env.CDSS_CIRCUIT_BREAKER_OPEN_MS, 30000);

    if (!this.cdssServiceUrl) {
      throw new Error('CDSS service URL is not configured. Set CDSS_SERVICE_URL, SERVICE_CDSS_URL, or SERVICE_BASE_URL.');
    }

    this.cdssClient = axios.create({
      baseURL: this.cdssServiceUrl,
      timeout: this.defaultTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request interceptor for debugging
    this.cdssClient.interceptors.request.use(request => {
      if (!request.headers) {
        request.headers = new AxiosHeaders();
      }
      if (this.cdssServiceAuthMode === 'token' || this.cdssServiceAuthMode === 'both') {
        if (this.cdssServiceToken) {
          (request.headers as InstanceType<typeof AxiosHeaders>).set('X-Service-Token', this.cdssServiceToken);
        }
      }
      if (this.cdssServiceAuthMode === 'jwt' || this.cdssServiceAuthMode === 'both') {
        const serviceJwt = this.createServiceJwt(request.url, request.method);
        if (serviceJwt) {
          (request.headers as InstanceType<typeof AxiosHeaders>).set('Authorization', `Bearer ${serviceJwt}`);
        }
      }
      (request.headers as InstanceType<typeof AxiosHeaders>).set('X-Service-Name', 'ehr-service');
      this.logger.log(`[CDSS] Request to: ${request.url}`);
      return request;
    });
    
    // Add response interceptor for debugging
    this.cdssClient.interceptors.response.use(
      response => {
        this.logger.log(`[CDSS] Response status: ${response.status}`);
        return response;
      },
      error => {
        this.logger.warn(`[CDSS] Request failed: ${error.code || error.message}`);
        return Promise.reject(error);
      }
    );
  }

  private buildCdssRequestConfig(timeout: number, tenantId?: string): AxiosRequestConfig {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    return {
      timeout,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  private mergeRequestConfig(base: AxiosRequestConfig, overrides?: AxiosRequestConfig): AxiosRequestConfig {
    const mergedHeaders = {
      ...(base.headers as Record<string, string> | undefined),
      ...(overrides?.headers as Record<string, string> | undefined),
    };
    return {
      ...base,
      ...overrides,
      headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
    };
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(raw || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseDateInput(raw: any): Date | null {
    if (!raw) return null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private secondsSince(rawStart: any): number | null {
    const start = this.parseDateInput(rawStart);
    if (!start) return null;
    const seconds = (Date.now() - start.getTime()) / 1000;
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds;
  }

  private ensureCircuitClosed(eventType: string): void {
    if (this.circuitState !== 'open') {
      return;
    }
    const openedAt = this.circuitOpenedAt ?? Date.now();
    const elapsed = Date.now() - openedAt;
    if (elapsed >= this.circuitOpenMs) {
      this.circuitState = 'half_open';
      return;
    }
    const err = new Error(`CDSS circuit breaker is open for ${eventType}`);
    (err as any).code = 'CDSS_CIRCUIT_OPEN';
    throw err;
  }

  private onCdssCallSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = 'closed';
    this.circuitOpenedAt = null;
  }

  private onCdssCallFailure(): void {
    this.consecutiveFailures += 1;
    if (this.circuitState === 'half_open' || this.consecutiveFailures >= this.circuitFailureThreshold) {
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
      this.logger.warn(`[CDSS] Circuit opened after ${this.consecutiveFailures} consecutive failures`);
    }
  }

  private isRetryableError(error: any): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }
    if (!error.response) {
      return true;
    }
    return [408, 429, 500, 502, 503, 504].includes(error.response.status);
  }

  private classifyCdssError(error: any): string {
    if ((error as any)?.code === 'CDSS_CIRCUIT_OPEN') {
      return 'circuit_open';
    }
    const rawMessage = String(
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.response?.data ||
      error?.message ||
      '',
    ).toLowerCase();
    if (rawMessage.includes('allowlist') || rawMessage.includes('egress')) {
      return 'egress_block';
    }
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return 'timeout';
      }
      if (error.response) {
        return `http_${error.response.status}`;
      }
      return 'network';
    }
    return 'unknown';
  }

  private recordAbstentionMetric(eventType: string, responseData: any, tenantId?: string): void {
    if (!this.metricsService || !responseData || typeof responseData !== 'object') {
      return;
    }
    if ((responseData as any).abstained !== true) {
      return;
    }
    const reason = String((responseData as any).abstain_reason || 'unspecified');
    this.metricsService.recordCdssAbstention(eventType, reason, tenantId);
  }

  private async recordGovernedPromptAudit(payload: {
    tenantDb?: DataSource;
    tenantId?: string;
    useCase: string;
    source: string;
    model?: string;
    patientId?: string | null;
    encounterId?: string | null;
    requestBody?: Record<string, any>;
    responseSummary?: Record<string, any>;
    governance?: Record<string, any>;
  }): Promise<void> {
    if (!payload.tenantDb || !this.hipaaAuditService) {
      return;
    }

    try {
      const promptHash = createHash('sha256')
        .update(JSON.stringify(payload.requestBody || {}))
        .digest('hex');
      const modelId = String(payload.model || 'unknown_model');
      const provider = String(
        payload.governance?.vendor_id ||
        payload.governance?.vendorId ||
        payload.governance?.provider ||
        'local',
      );

      await this.hipaaAuditService.registerModelEntry(payload.tenantDb, {
        modelId,
        modelName: modelId,
        modelVersion: String(process.env.CDSS_MODEL_VERSION || modelId),
        provider,
        status: 'active',
        metadata: {
          source: payload.source,
          useCase: payload.useCase,
          tenantId: payload.tenantId || null,
        },
      });

      await this.hipaaAuditService.logPromptAudit(payload.tenantDb, {
        promptHash,
        templateVersion: 'sprint111_moas11_v1',
        modelId,
        patientId: payload.patientId || null,
        encounterId: payload.encounterId || null,
        requestId: randomUUID(),
        safetyGateTriggered: payload.responseSummary?.abstained === true,
        metadata: {
          source: payload.source,
          useCase: payload.useCase,
          tenantId: payload.tenantId || null,
          governance: payload.governance || {},
          responseSummary: payload.responseSummary || {},
        },
      });
    } catch (error: any) {
      this.logger.warn(`Governed prompt audit failed for ${payload.useCase}: ${error?.message || error}`);
    }
  }

  private async postWithPolicy<T>(
    eventType: string,
    path: string,
    payload: any,
    timeoutMs: number,
    tenantId?: string,
  ): Promise<T> {
    return this.requestWithPolicy<T>('POST', eventType, path, payload, timeoutMs, tenantId);
  }

  private async getWithPolicy<T>(
    eventType: string,
    path: string,
    timeoutMs: number,
    tenantId?: string,
    params?: Record<string, any>,
  ): Promise<T> {
    return this.requestWithPolicy<T>('GET', eventType, path, params, timeoutMs, tenantId);
  }

  private async requestWithPolicy<T>(
    method: 'GET' | 'POST',
    eventType: string,
    path: string,
    payload: any,
    timeoutMs: number,
    tenantId?: string,
    overrides?: AxiosRequestConfig,
  ): Promise<T> {
    this.ensureCircuitClosed(eventType);
    const startedAt = Date.now();
    const maxAttempts = this.retryMax + 1;
    let lastError: any;
    let retries = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const requestConfig = this.mergeRequestConfig(
          this.buildCdssRequestConfig(timeoutMs, tenantId),
          overrides,
        );
        const requestFn = (this.cdssClient as any).request;
        const response = typeof requestFn === 'function'
          ? await requestFn.call(this.cdssClient, {
              method,
              url: path,
              ...(method === 'GET' ? { params: payload } : { data: payload }),
              ...requestConfig,
            })
          : method === 'GET'
            ? await (this.cdssClient as any).get(path, {
                ...requestConfig,
                params: payload,
              })
            : await (this.cdssClient as any).post(path, payload, requestConfig);
        const durationSeconds = (Date.now() - startedAt) / 1000;
        this.metricsService?.recordCdssHook(eventType, 'success', durationSeconds, tenantId);
        this.recordAbstentionMetric(eventType, response.data, tenantId);
        this.onCdssCallSuccess();
        return response.data as T;
      } catch (error: any) {
        lastError = error;
        const errorType = this.classifyCdssError(error);
        if (errorType === 'timeout') {
          this.metricsService?.recordCdssTimeout(eventType, tenantId);
        }
        const retryable = this.isRetryableError(error);
        if (retryable && attempt < maxAttempts) {
          retries += 1;
          this.metricsService?.recordCdssRetry(eventType, errorType, tenantId);
          const delayMs = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delayMs);
          continue;
        }

        const durationSeconds = (Date.now() - startedAt) / 1000;
        this.metricsService?.recordCdssHook(eventType, 'error', durationSeconds, tenantId);
        this.metricsService?.recordCdssHookError(eventType, errorType, tenantId);
        if (retries > 0) {
          this.logger.warn(`[CDSS] ${eventType} failed after ${retries} retries`);
        }
        this.onCdssCallFailure();
        break;
      }
    }

    throw lastError;
  }

  private requiredServiceScopeForRequest(path: string, method?: string): string {
    const normalizedPath = String(path || '').split('?')[0];
    const upperMethod = String(method || 'POST').toUpperCase();
    if (normalizedPath === '/diagnosis/suggest/intelligent' && upperMethod === 'POST') {
      return 'cdss.copilot.diagnosis.write';
    }
    if (normalizedPath === '/patient/summarize' && upperMethod === 'POST') {
      return 'cdss.copilot.summary.write';
    }
    if (normalizedPath === '/registration/documents/analyze' && upperMethod === 'POST') {
      return 'cdss.copilot.registration.write';
    }
    if (normalizedPath === '/guidelines/search' && upperMethod === 'POST') {
      return 'cdss.copilot.guidelines.read';
    }
    if (normalizedPath.startsWith('/admin/')) {
      return 'cdss.admin.*';
    }
    return 'cdss.api.invoke';
  }

  private buildServiceScopesForRequest(path?: string, method?: string): string[] {
    const required = this.requiredServiceScopeForRequest(path || '', method);
    const scopes = new Set<string>(['cdss.api.invoke', required]);
    return Array.from(scopes);
  }

  private createServiceJwt(path?: string, method?: string): string | null {
    const secret = this.cdssServiceJwtSecret;
    if (!secret || secret.length < 24) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    const scopes = this.buildServiceScopesForRequest(path, method);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: this.cdssServiceJwtIssuer,
      aud: this.cdssServiceJwtAudience,
      sub: 'ehr-service',
      iat: now,
      exp: now + 60,
      jti: randomUUID(),
      scope: scopes.join(' '),
      scopes,
    };
    const enc = (obj: Record<string, any>) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const body = `${enc(header)}.${enc(payload)}`;
    const sig = createHmac('sha256', secret)
      .update(body)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${body}.${sig}`;
  }

  /**
   * Check drug interactions using Python CDSS service
   * Falls back to basic checking if CDSS service unavailable
   */
  async checkDrugInteractions(drugIds: string[], patientId?: string, tenantDb?: DataSource) {
    try {
      // Fetch drug data from database to send to CDSS service
      let drugsData: any[] = [];
      if (tenantDb) {
        const { Drug } = await import('../entities/drug.entity');
        const drugRepo = tenantDb.getRepository(Drug);
        for (const drugId of drugIds) {
          try {
            const drug = await drugRepo.findOne({ where: { id: drugId, isActive: true } });
            if (drug) {
              drugsData.push({
                id: drug.id,
                genericName: drug.genericName,
                name: drug.genericName,
                drugClass: drug.drugClass
              });
            }
          } catch (err) {
            this.logger.warn(`Failed to fetch drug ${drugId}: ${err.message}`);
          }
        }
      }

      // Try advanced checking via Python CDSS service
      const responseData = await this.postWithPolicy<any>(
        'drug_interactions',
        '/drugs/interactions/advanced',
        {
        drug_ids: drugIds,
        patient_id: patientId,
        drugs_data: drugsData.length > 0 ? drugsData : undefined,
        },
        15000,
      );

      return {
        hasInteractions: responseData.interactions?.length > 0,
        interactions: responseData.interactions || [],
        severity_summary: responseData.severity_summary,
        recommendations: responseData.recommendations || [],
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS service unavailable, using basic checking: ${error.message}`);
      // Fallback to basic checking
      return this.basicDrugInteractionCheck(drugIds);
    }
  }

  async checkDrugInteractionsAdvanced(params: {
    patientId: string;
    newDrug: string;
    currentMedications: string[];
    allergies: string[];
  }): Promise<{ interactions: Array<{ severity: string; severity_score: number; interactingDrug: string; clinical_significance: string; [key: string]: any }> }> {
    try {
      const responseData = await this.postWithPolicy<any>(
        'drug_interactions_advanced',
        '/drugs/interactions/advanced',
        {
          patient_id: params.patientId,
          new_drug: params.newDrug,
          current_medications: params.currentMedications,
          allergies: params.allergies,
        },
        15000,
      );
      return {
        interactions: responseData.interactions || [],
      };
    } catch (error: any) {
      this.logger.warn(`checkDrugInteractionsAdvanced failed: ${error.message}`);
      return { interactions: [] };
    }
  }

  /**
   * Run Zimbabwe HIV testing algorithm via Python CDSS service
   */
  async runHivTestingAlgorithm(
    tests: Array<{ test_kit_name: string; test_result: string; test_date: any; tested_by: any }>,
    tenantId?: string,
  ) {
    const responseData = await this.postWithPolicy<any>(
      'hiv_testing_algorithm',
      '/hiv/testing/algorithm',
      {
        tests,
      },
      10000,
      tenantId,
    );

    return {
      ...responseData,
      source: responseData?.source || 'cdss_hiv_algorithm',
    };
  }

  /**
   * Basic drug interaction checking (fallback) — curated local table.
   * Covers the highest-risk pairs relevant to Zimbabwe TB/HIV/malaria co-treatment context.
   * Conservative: only flags known dangerous pairs, never clears unknown combinations.
   */
  private async basicDrugInteractionCheck(drugIds: string[]) {
    const KNOWN_INTERACTIONS: Array<{
      drugA: string; drugB: string;
      severity: 'critical' | 'major' | 'moderate';
      description: string;
      recommendation: string;
    }> = [
      // TB/HIV co-treatment — high prevalence in Zimbabwe
      { drugA: 'rifampicin', drugB: 'efavirenz', severity: 'major', description: 'Rifampicin induces CYP3A4, reducing efavirenz levels ~26%. Sub-therapeutic ARV levels risk treatment failure.', recommendation: 'Increase efavirenz to 800mg/day or switch regimen per national TB/HIV guidelines.' },
      { drugA: 'rifampicin', drugB: 'nevirapine', severity: 'critical', description: 'Rifampicin reduces nevirapine AUC ~58%. High risk of virological failure.', recommendation: 'Avoid. Use efavirenz-based regimen per WHO TB/HIV co-treatment guidelines.' },
      { drugA: 'rifampicin', drugB: 'lopinavir', severity: 'critical', description: 'Rifampicin reduces lopinavir levels >75%. Combination not recommended.', recommendation: 'Avoid or use super-boosted LPV/r (400/400mg BD). Consult HIV specialist.' },
      { drugA: 'rifampicin', drugB: 'dolutegravir', severity: 'major', description: 'Rifampicin reduces dolutegravir AUC ~54%.', recommendation: 'Double dolutegravir to 50mg BD when co-administered with rifampicin.' },
      { drugA: 'rifampicin', drugB: 'warfarin', severity: 'major', description: 'Rifampicin is a strong CYP2C9 inducer — INR may fall dramatically.', recommendation: 'Monitor INR weekly. Warfarin dose may need to increase 2–5-fold. Recheck until stable.' },
      // Anticoagulant bleeding risk
      { drugA: 'warfarin', drugB: 'aspirin', severity: 'major', description: 'Additive bleeding risk — platelet inhibition plus anticoagulation.', recommendation: 'Avoid unless strong indication. If necessary, use lowest aspirin dose and monitor for bleeding.' },
      { drugA: 'warfarin', drugB: 'ibuprofen', severity: 'major', description: 'NSAIDs inhibit platelets, cause GI erosion and may elevate INR.', recommendation: 'Avoid NSAIDs. Use paracetamol for analgesia. Monitor INR if unavoidable.' },
      { drugA: 'warfarin', drugB: 'metronidazole', severity: 'major', description: 'Metronidazole inhibits CYP2C9 — INR can double within days.', recommendation: 'Reduce warfarin ~50% empirically. Check INR every 2–3 days during metronidazole course.' },
      { drugA: 'warfarin', drugB: 'fluconazole', severity: 'major', description: 'Potent CYP2C9 inhibitor — INR may double within 48h.', recommendation: 'Reduce warfarin dose. Monitor INR every 2–3 days. Consider alternative antifungal.' },
      { drugA: 'warfarin', drugB: 'cotrimoxazole', severity: 'major', description: 'Cotrimoxazole inhibits CYP2C9 — significant INR elevation. Common in HIV patients on CTX prophylaxis.', recommendation: 'Monitor INR closely and reduce warfarin dose as needed.' },
      // Cardiac
      { drugA: 'digoxin', drugB: 'amiodarone', severity: 'critical', description: 'Amiodarone doubles digoxin levels — high risk of digoxin toxicity (bradycardia, AV block, arrhythmia).', recommendation: 'Reduce digoxin dose 50% on starting amiodarone. Monitor digoxin levels and ECG.' },
      { drugA: 'digoxin', drugB: 'clarithromycin', severity: 'major', description: 'Clarithromycin inhibits P-glycoprotein — digoxin levels rise significantly.', recommendation: 'Monitor for digoxin toxicity. Consider dose reduction or alternative antibiotic.' },
      { drugA: 'digoxin', drugB: 'erythromycin', severity: 'major', description: 'Erythromycin raises digoxin levels and also prolongs QT.', recommendation: 'Monitor digoxin levels. Use azithromycin as alternative if QTc not already prolonged.' },
      // QT prolongation — critical in malaria treatment context
      { drugA: 'artemether', drugB: 'amiodarone', severity: 'critical', description: 'Both prolong QT — risk of torsades de pointes.', recommendation: 'Avoid. Use alternative antimalarial. If unavoidable, continuous ECG monitoring required.' },
      { drugA: 'artemether', drugB: 'ciprofloxacin', severity: 'major', description: 'Additive QT prolongation.', recommendation: 'Use with caution. Obtain baseline ECG. Avoid if QTc >450ms.' },
      { drugA: 'halofantrine', drugB: 'lumefantrine', severity: 'critical', description: 'Severe additive QT prolongation — risk of fatal arrhythmia.', recommendation: 'Contraindicated. Do not combine.' },
      // Renal / metabolic
      { drugA: 'metformin', drugB: 'contrast', severity: 'major', description: 'Contrast can cause AKI, impairing metformin excretion — lactic acidosis risk.', recommendation: 'Hold metformin 48h before and after iodinated contrast. Check renal function before restarting.' },
      { drugA: 'cotrimoxazole', drugB: 'ramipril', severity: 'major', description: 'Both raise potassium — life-threatening hyperkalemia risk, especially in CKD.', recommendation: 'Monitor potassium within 1 week. Avoid in CKD stage 3b+.' },
      { drugA: 'cotrimoxazole', drugB: 'lisinopril', severity: 'major', description: 'Both raise potassium — common in HIV patients on CTX prophylaxis and ACE inhibitors.', recommendation: 'Monitor potassium closely. Avoid in advanced CKD.' },
      { drugA: 'lithium', drugB: 'ibuprofen', severity: 'critical', description: 'NSAIDs reduce renal lithium clearance — lithium toxicity risk (tremor, confusion, seizures).', recommendation: 'Contraindicated. Use paracetamol. Check lithium level urgently if inadvertent co-prescription.' },
      // Cytotoxic / antibiotic
      { drugA: 'methotrexate', drugB: 'ibuprofen', severity: 'critical', description: 'NSAIDs reduce methotrexate clearance — severe toxicity risk (myelosuppression, mucositis).', recommendation: 'Contraindicated during methotrexate therapy. Use paracetamol only.' },
      { drugA: 'ciprofloxacin', drugB: 'theophylline', severity: 'major', description: 'Ciprofloxacin inhibits CYP1A2 — theophylline levels rise, risk of toxicity.', recommendation: 'Reduce theophylline 30–50% or use alternative antibiotic. Monitor theophylline levels.' },
      { drugA: 'linezolid', drugB: 'fluoxetine', severity: 'critical', description: 'Linezolid is an MAOI — serotonin syndrome risk with SSRIs.', recommendation: 'Contraindicated. Discontinue SSRI ≥2 weeks before starting linezolid.' },
      { drugA: 'linezolid', drugB: 'sertraline', severity: 'critical', description: 'Serotonin syndrome risk (linezolid MAOI + SSRI).', recommendation: 'Contraindicated. See linezolid + fluoxetine guidance.' },
    ];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedIds = drugIds.map(normalize);

    const interactions: any[] = [];
    for (const pair of KNOWN_INTERACTIONS) {
      const a = normalize(pair.drugA);
      const b = normalize(pair.drugB);
      const aMatch = normalizedIds.some(id => id.includes(a) || a.includes(id));
      const bMatch = normalizedIds.some(id => id.includes(b) || b.includes(id));
      if (aMatch && bMatch) {
        interactions.push({
          drugA: pair.drugA, drugB: pair.drugB,
          severity: pair.severity,
          description: pair.description,
          recommendation: pair.recommendation,
          source: 'local_fallback',
        });
      }
    }

    const severity_summary = {
      critical: interactions.filter(i => i.severity === 'critical').length,
      major: interactions.filter(i => i.severity === 'major').length,
      moderate: interactions.filter(i => i.severity === 'moderate').length,
      minor: 0,
    };

    return {
      hasInteractions: interactions.length > 0,
      interactions,
      severity_summary,
      recommendations: interactions.map(i => i.recommendation),
      source: 'local_fallback',
      cdss_unavailable: true,
      warning: 'CDSS service unavailable. Showing local interaction table (critical pairs only). Full checking requires CDSS service.',
    };
  }

  /**
   * Diagnostic assistance using Python CDSS service
   * Uses intelligent endpoint (rule-based + AI) if available, falls back to rule-based
   */
  async diagnosisAssist(symptoms: any, useIntelligent: boolean = true, tenantId?: string, tenantDb?: DataSource) {
    try {
      // Handle different input formats
      let symptomList: string[] = [];
      if (symptoms.symptoms && Array.isArray(symptoms.symptoms)) {
        symptomList = symptoms.symptoms;
      } else if (symptoms.symptoms && typeof symptoms.symptoms === 'string') {
        symptomList = [symptoms.symptoms];
      } else if (symptoms.chiefComplaint) {
        symptomList = [symptoms.chiefComplaint];
      } else if (Array.isArray(symptoms)) {
        symptomList = symptoms;
      }
      
      // Normalize symptoms - keep original text for better matching
      const normalizedSymptoms = symptomList
        .map(s => String(s).trim())
        .filter(s => s.length > 0)
        .map(s => s.toLowerCase());
      
      // Try intelligent endpoint first (if enabled and data available)
      const hasClinicalNotes = symptoms.clinicalNotes || symptoms.chiefComplaint || symptoms.historyOfPresentIllness;
      const hasPatientData = symptoms.age || symptoms.gender || symptoms.vitals || symptoms.labs;
      
      if (useIntelligent && (hasClinicalNotes || hasPatientData)) {
        try {
          const intelligentData = await this.postWithPolicy<any>(
            'diagnosis_assist_intelligent',
            '/diagnosis/suggest/intelligent',
            {
            symptoms: normalizedSymptoms,
            vitals: symptoms.vitals || undefined,
            clinical_notes: symptoms.clinicalNotes || symptoms.chiefComplaint || symptoms.historyOfPresentIllness || undefined,
            patient_data: {
              age: symptoms.age,
              gender: symptoms.gender,
              vitals: symptoms.vitals,
              labs: symptoms.labs,
              conditions: symptoms.conditions || symptoms.diagnoses || [],
              context: symptoms.context || undefined,
              specialty: symptoms.specialty || undefined,
              module: symptoms.module || undefined,
            },
            age: symptoms.age || undefined,
            gender: symptoms.gender || undefined,
              labs: symptoms.labs || undefined,
              conditions: symptoms.conditions || symptoms.diagnoses || undefined
            },
            20000,
            tenantId,
          );
          await this.recordGovernedPromptAudit({
            tenantDb,
            tenantId,
            useCase: 'cdss_intelligent_diagnosis',
            source: 'cdss_service',
            model: String(
              intelligentData?.model ||
              intelligentData?.model_trace?.llm_model ||
              intelligentData?.provenance?.model_trace?.llm_model ||
              intelligentData?.ai_models_used?.llm ||
              'intelligent_diagnosis_proxy',
            ),
            patientId: symptoms?.patientId || null,
            encounterId: symptoms?.encounterId || null,
            requestBody: {
              symptomCount: normalizedSymptoms.length,
              symptomSample: normalizedSymptoms.slice(0, 5),
              hasVitals: !!symptoms.vitals,
              hasLabs: !!symptoms.labs,
              hasClinicalNotes: !!hasClinicalNotes,
              age: symptoms.age || null,
              gender: symptoms.gender || null,
              context: symptoms.context || null,
              conditions: Array.isArray(symptoms.conditions || symptoms.diagnoses)
                ? (symptoms.conditions || symptoms.diagnoses).slice(0, 10)
                : [],
            },
            responseSummary: {
              suggestedDiagnosisCount: Array.isArray(intelligentData?.suggested_diagnoses)
                ? intelligentData.suggested_diagnoses.length
                : 0,
              redFlagCount: Array.isArray(intelligentData?.red_flags) ? intelligentData.red_flags.length : 0,
              aiEnabled: Boolean(intelligentData?.ai_enabled),
              abstained: intelligentData?.abstained === true,
              confidenceBand: intelligentData?.confidence_band || null,
            },
            governance: intelligentData?.governance || {},
          });
          this.logger.log(`Intelligent CDSS response received (AI enabled: ${intelligentData?.ai_enabled})`);
          
          // Return intelligent results if available
          if (intelligentData?.suggested_diagnoses?.length > 0) {
            return {
              suggested_diagnoses: intelligentData.suggested_diagnoses.map((d: any) => ({
                diagnosis: d.diagnosis,
                probability: d.probability,
                icd10: d.icd10,
                confidence: d.confidence,
                sources: d.sources,
                explanation: d.explanation
              })),
              recommendedTests: intelligentData.recommended_tests || [],
              recommended_tests: intelligentData.recommended_tests || [],
              urgencyLevel: intelligentData.red_flags?.length > 0 ? 'high' : 'moderate',
              red_flags: intelligentData.red_flags || [],
              source: intelligentData.source || 'hybrid_cdss_ai',
              ai_enabled: intelligentData.ai_enabled || false,
              ai_models_used: intelligentData.ai_models_used || {},
              explanation: intelligentData.explanation
            };
          }
        } catch (intelligentError: any) {
          this.logger.warn(`Intelligent CDSS endpoint failed, falling back to rule-based: ${intelligentError.message}`);
          // Fall through to rule-based endpoint
        }
      }
      
      // Fallback to rule-based endpoint
      const responseData = await this.postWithPolicy<any>(
        'diagnosis_assist',
        '/diagnosis/suggest',
        {
        symptoms: normalizedSymptoms,
        vitals: symptoms.vitals || undefined,
        age: symptoms.age || undefined,
        gender: symptoms.gender || undefined,
        },
        10000,
        tenantId,
      );
      
      // Ensure the response has diagnoses (not just empty arrays)
      const hasDiagnoses = responseData?.suggested_diagnoses?.length > 0 || 
                          responseData?.differentialDiagnoses?.length > 0;
      
      if (responseData && hasDiagnoses) {
        this.logger.log(`CDSS returned ${responseData.suggested_diagnoses?.length || responseData.differentialDiagnoses?.length} diagnoses`);
        return responseData;
      }
      
      // If Python service returns empty, use fallback
      this.logger.warn(`CDSS returned empty diagnoses (suggested_diagnoses: ${responseData?.suggested_diagnoses?.length || 0}, differentialDiagnoses: ${responseData?.differentialDiagnoses?.length || 0}), using fallback`);
      return this.basicDiagnosisAssist(symptoms);
    } catch (error: any) {
      this.logger.warn(`CDSS diagnostic assistance unavailable: ${error.message}`);
      // Fallback to basic logic
      return this.basicDiagnosisAssist(symptoms);
    }
  }

  async patientAdherenceAssist(
    payload: {
      patientId: string;
      sessionId?: string;
      message: string;
      medications?: string[];
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      visitContext?: {
        visitId?: string;
        visitDate?: string;
        doctorName?: string;
        diagnoses?: string[];
        soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
        quickSummary?: string;
      } | null;
    },
    tenantId?: string,
  ): Promise<PatientAdherenceAssistantResponse> {
    const responseData = await this.postWithPolicy<any>(
      'patient_adherence_chat',
      '/patient/adherence-chat',
      {
        patient_id: payload.patientId,
        session_id: payload.sessionId,
        message: payload.message,
        medications: payload.medications || [],
        history: payload.history || [],
        visit_context: payload.visitContext ?? null,
      },
      15000,
      tenantId,
    );

    return {
      reply: String(responseData?.reply || '').trim(),
      intent: responseData?.intent || 'general',
      adherenceConcern: Boolean(responseData?.adherence_concern),
      requiresClinicianFollowUp: Boolean(responseData?.requires_clinician_follow_up),
      urgency: responseData?.urgency === 'urgent' ? 'urgent' : 'routine',
      confidence: Number(responseData?.confidence || 0),
      model: String(responseData?.model || 'cdss_patient_adherence_guardrail'),
      abstained: Boolean(responseData?.abstained),
      abstainReason: responseData?.abstain_reason || null,
      reasoning: responseData?.reasoning || '',
      evidence: Array.isArray(responseData?.evidence) ? responseData.evidence : [],
      governance: responseData?.governance || {},
    };
  }

  async patientSymptomCheck(
    payload: {
      symptoms: string[];
      durationDays?: number;
      severity?: string;
      patientContext?: Record<string, any>;
    },
    tenantId?: string,
  ): Promise<PatientSymptomCheckResponse> {
    const responseData = await this.postWithPolicy<any>(
      'patient_symptom_check',
      '/symptom-check',
      {
        symptoms: payload.symptoms || [],
        duration_days: payload.durationDays,
        severity: payload.severity,
        patient_context: payload.patientContext || {},
      },
      12000,
      tenantId,
    );

    return {
      differential: Array.isArray(responseData?.differential) ? responseData.differential : [],
      triageLevel: responseData?.triage_level || 'routine',
      recommendedAction: responseData?.recommended_action || 'Schedule appointment with your doctor.',
      confidence: Number(responseData?.confidence || 0),
      model: String(responseData?.model || 'symptom_check_rules_v1'),
      abstained: Boolean(responseData?.abstained),
      abstainReason: responseData?.abstain_reason || null,
      evidence: Array.isArray(responseData?.evidence) ? responseData.evidence : [],
      governance: responseData?.governance || {},
    };
  }

  /**
   * Basic diagnostic assistance (fallback) — local rule-based engine.
   * Tuned for Zimbabwe disease burden: TB, HIV, Malaria, Cholera co-prevalence.
   * Conservative: only surfaces diagnoses with clear symptom support.
   */
  private async basicDiagnosisAssist(symptoms: any) {
    let symptomText = '';
    if (typeof symptoms === 'string') {
      symptomText = symptoms.toLowerCase();
    } else if (symptoms?.symptoms) {
      symptomText = (Array.isArray(symptoms.symptoms)
        ? symptoms.symptoms.join(' ')
        : String(symptoms.symptoms)).toLowerCase();
    }
    if (symptoms?.chiefComplaint) symptomText += ' ' + String(symptoms.chiefComplaint).toLowerCase();
    if (symptoms?.clinicalNotes) symptomText += ' ' + String(symptoms.clinicalNotes).toLowerCase();

    const age = Number(symptoms?.age) || null;

    const has = (pattern: RegExp) => pattern.test(symptomText);
    const hasFever            = has(/fever|pyrexia|febrile|high.?temp/);
    const hasCough            = has(/cough|haemoptysis|hemoptysis|sputum/);
    const hasChestPain        = has(/chest.?pain|chest.?tight|pleuritic/);
    const hasSob              = has(/short.?ness.?of.?breath|dyspn[oe]a|sob|difficulty.?breath/);
    const hasProlongedCough   = has(/chronic.?cough|cough.*\d+.?week|week.*cough|cough.*month/);
    const hasNightSweats      = has(/night.?sweat/);
    const hasWeightLoss       = has(/weight.?loss|losing.?weight|wasting/);
    const hasRigors           = has(/rigor|chills|shivering/);
    const hasDiarrhea         = has(/diarr[h]?[o]?ea|loose.?stool|watery.?stool|bloody.?stool/);
    const hasVomiting         = has(/vomit|nausea/);
    const hasHeadache         = has(/headache|head.?ache/);
    const hasAlteredConsciousness = has(/confused|confusion|unconsci|altered.?mental|seizure/);
    const hasAbdoPain         = has(/abdomin|abdo.?pain|stomach.?pain|epigastric/);
    const hasDysuria          = has(/dysuria|burning.?urin|frequency|urgency/);
    const hasPalpitations     = has(/palpitation|fast.?heart|racing.?heart/);
    const hasSyncope          = has(/syncope|faint|collapse|pass.?out/);

    type Confidence = 'high' | 'moderate' | 'low';
    const diagnoses: Array<{ diagnosis: string; probability: number; confidence: Confidence; reasoning: string }> = [];
    const redFlags: string[] = [];
    const recommendedTests: string[] = [];

    // Malaria — high base prevalence in Zimbabwe
    if (hasFever && hasRigors) {
      diagnoses.push({ diagnosis: 'Malaria', probability: 0.60, confidence: 'moderate', reasoning: 'Fever with rigors is classic presentation of malaria in endemic Zimbabwe.' });
      recommendedTests.push('Malaria RDT or thick/thin blood film');
      if (hasAlteredConsciousness) redFlags.push('Altered consciousness with fever — consider cerebral malaria. Urgent IV artesunate required.');
    } else if (hasFever) {
      diagnoses.push({ diagnosis: 'Malaria', probability: 0.35, confidence: 'low', reasoning: 'Fever in Zimbabwe — malaria must be excluded regardless of other findings.' });
      recommendedTests.push('Malaria RDT');
    }

    // Pulmonary TB — key triggers per WHO W4SS criteria
    if (hasProlongedCough || (hasCough && hasNightSweats) || (hasCough && hasWeightLoss)) {
      const tbProb = (hasProlongedCough && (hasNightSweats || hasWeightLoss)) ? 0.65 : 0.45;
      diagnoses.push({ diagnosis: 'Pulmonary Tuberculosis', probability: tbProb, confidence: tbProb >= 0.6 ? 'moderate' : 'low', reasoning: 'WHO W4SS criteria met: cough ≥2 weeks and/or constitutional symptoms (night sweats, weight loss).' });
      recommendedTests.push('Sputum GeneXpert MTB/RIF', 'Chest X-ray', 'HIV test (TB/HIV co-infection screening)');
      if (hasWeightLoss && hasNightSweats && hasCough) redFlags.push('Classic TB symptom triad: cough + weight loss + night sweats. Initiate TB investigations urgently and institute infection control precautions.');
    }

    // Community-acquired pneumonia
    if (hasFever && hasCough && hasSob) {
      diagnoses.push({ diagnosis: 'Community-Acquired Pneumonia', probability: 0.55, confidence: 'moderate', reasoning: 'Fever + productive cough + dyspnoea triad is consistent with pneumonia.' });
      recommendedTests.push('Chest X-ray', 'Full Blood Count', 'Blood culture (if hospitalised)');
      redFlags.push('Dyspnoea with fever — assess SpO2 urgently. SpO2 <94% requires supplemental oxygen and prompt antibiotic therapy.');
    }

    // Typhoid
    if (hasFever && hasAbdoPain && !hasRigors && age !== null && age > 5) {
      diagnoses.push({ diagnosis: 'Typhoid Fever', probability: 0.30, confidence: 'low', reasoning: 'Sustained fever with abdominal symptoms without rigors in a school-age or older patient.' });
      recommendedTests.push('Blood culture (gold standard)', 'Widal test (limited specificity)', 'Full Blood Count');
    }

    // Cholera / acute gastroenteritis
    if (hasDiarrhea && hasVomiting) {
      const severity = has(/rice.?water|profuse|watery/) ? 0.55 : 0.35;
      diagnoses.push({ diagnosis: 'Acute Gastroenteritis / Cholera', probability: severity, confidence: severity > 0.45 ? 'moderate' : 'low', reasoning: 'Diarrhoea and vomiting — cholera must be considered in Zimbabwe, especially during outbreak periods.' });
      recommendedTests.push('Stool microscopy and culture', 'Electrolytes (dehydration severity)', 'Cholera RDT if available');
      redFlags.push('Assess hydration status immediately. Severe dehydration can be fatal within hours. Start ORS or IV fluids per WHO dehydration plan.');
    }

    // Bacterial meningitis
    if (hasFever && hasHeadache && hasAlteredConsciousness) {
      diagnoses.push({ diagnosis: 'Bacterial Meningitis', probability: 0.55, confidence: 'moderate', reasoning: 'Fever + headache + altered consciousness = meningism triad until proven otherwise.' });
      recommendedTests.push('Lumbar puncture (after fundoscopy/CT if raised ICP suspected)', 'Blood cultures', 'Blood glucose and FBC');
      redFlags.push('EMERGENCY: Fever + altered consciousness + headache. Administer empiric ceftriaxone IV immediately if bacterial meningitis suspected — do not delay treatment awaiting LP.');
    }

    // ACS / cardiac chest pain
    if (hasChestPain && (hasSob || hasPalpitations || hasSyncope)) {
      diagnoses.push({ diagnosis: 'Acute Coronary Syndrome', probability: 0.40, confidence: 'low', reasoning: 'Chest pain with associated cardiac symptoms warrants urgent ACS workup.' });
      recommendedTests.push('12-lead ECG (urgent)', 'Troponin', 'Chest X-ray');
      redFlags.push('Chest pain with dyspnoea or syncope — obtain 12-lead ECG immediately. STEMI requires thrombolysis within 30 minutes of diagnosis.');
    }

    // UTI
    if (hasDysuria && !hasFever) {
      diagnoses.push({ diagnosis: 'Urinary Tract Infection', probability: 0.55, confidence: 'moderate', reasoning: 'Dysuria/frequency without fever suggests lower UTI.' });
      recommendedTests.push('Urine dipstick', 'Midstream urine culture and sensitivity');
    }

    diagnoses.sort((a, b) => b.probability - a.probability);
    const topDiagnoses = diagnoses.slice(0, 5).map(d => ({
      diagnosis: d.diagnosis,
      probability: d.probability,
      confidence: d.confidence,
      reasoning: d.reasoning,
      matching_symptoms: [],
      source: 'local_fallback',
    }));

    return {
      suggested_diagnoses: topDiagnoses,
      recommended_tests: [...new Set(recommendedTests)],
      red_flags: redFlags,
      differentialDiagnoses: topDiagnoses,
      recommendedTests: [...new Set(recommendedTests)],
      urgencyLevel: redFlags.length > 0 ? 'high' : diagnoses.some(d => d.probability >= 0.5) ? 'moderate' : 'low',
      source: 'local_fallback',
      cdss_unavailable: true,
      warning: 'CDSS service unavailable. Showing local rule-based fallback. Results are indicative only — must be validated clinically.',
    };
  }

  /**
   * Get clinical guidelines from Python CDSS service
   * Now integrates WHO Smart Guidelines if available
   */
  async getGuidelines(condition: string, patientData?: any, tenantId?: string, tenantDb?: DataSource) {
    // Governed CDSS knowledge layer is the primary source.
    try {
      const responseData = await this.postWithPolicy<any>(
        'guidelines_check',
        '/guidelines/check',
        {
        condition,
        patient_age: patientData?.age,
        patient_gender: patientData?.gender,
        comorbidities: patientData?.comorbidities || patientData?.conditions || [],
        medications: patientData?.medications || [],
        specialty: patientData?.specialty || null,
        module: patientData?.module || null,
        },
        10000,
        tenantId,
      );
      await this.recordGovernedPromptAudit({
        tenantDb,
        tenantId,
        useCase: 'cdss_guidelines_check',
        source: 'cdss_service',
        model: String(responseData?.model || 'guidelines_check_proxy'),
        patientId: patientData?.patientId || null,
        encounterId: patientData?.encounterId || null,
        requestBody: {
          condition,
          patientAge: patientData?.age ?? null,
          patientGender: patientData?.gender ?? null,
          comorbidityCount: Array.isArray(patientData?.comorbidities || patientData?.conditions)
            ? (patientData?.comorbidities || patientData?.conditions).length
            : 0,
          medicationCount: Array.isArray(patientData?.medications) ? patientData.medications.length : 0,
          specialty: patientData?.specialty || null,
          module: patientData?.module || null,
        },
        responseSummary: {
          recommendationCount: Array.isArray(responseData?.recommendations) ? responseData.recommendations.length : 0,
          contraindicationCount: Array.isArray(responseData?.contraindications) ? responseData.contraindications.length : 0,
          evidenceLevel: responseData?.evidence_level || null,
          abstained: responseData?.abstained === true,
        },
        governance: responseData?.governance || {},
      });

      // ── Stock context enrichment ──────────────────────────────────────────
      let wardStockContext: string | undefined;
      if (this.storeroomService && patientData?.wardLocationId && tenantDb) {
        try {
          const wardStock: any[] = await this.storeroomService.getStockByLocation(tenantDb, patientData.wardLocationId);
          const inStock = wardStock.filter((s: any) => s.quantity_on_hand > 0).map((s: any) => s.item_name).join(', ');
          const oos = wardStock.filter((s: any) => s.quantity_on_hand === 0).map((s: any) => s.item_name).join(', ');
          if (inStock || oos) {
            wardStockContext = [
              inStock ? `Available at ward: ${inStock}` : '',
              oos ? `Out of stock at ward: ${oos}` : '',
            ].filter(Boolean).join('. ');
          }
        } catch { /* non-blocking */ }
      }

      // ── Drug substitution suggestions when prescribed drug is OOS ─────────
      let substitutionSuggestions: any[] | undefined;
      if (this.storeroomService && this.intelligenceService && patientData?.prescribedCatalogId && patientData?.wardLocationId && tenantDb) {
        try {
          const avail = await this.storeroomService.checkAvailability(
            tenantDb, patientData.wardLocationId, patientData.prescribedCatalogId, patientData.quantity ?? 1,
          );
          if (!avail.available) {
            substitutionSuggestions = await this.intelligenceService.suggestSubstitutions(
              tenantDb, patientData.prescribedCatalogId, patientData.quantity ?? 1, patientData.wardLocationId,
            );
          }
        } catch { /* non-blocking */ }
      }
      // ── end stock context ─────────────────────────────────────────────────

      return {
        guidelines: responseData.guidelines || [],
        recommendations: responseData.recommendations || [],
        contraindications: responseData.contraindications || [],
        medication_warnings: responseData.medication_warnings || [],
        evidence_level: responseData.evidence_level,
        matched_condition: responseData.matched_condition,
        source: 'advanced_cdss',
        knowledge_metadata: responseData.knowledge_metadata || null,
        abstained: responseData.abstained === true,
        abstain_reason: responseData.abstain_reason || null,
        ...(wardStockContext ? { ward_stock_context: wardStockContext } : {}),
        ...(substitutionSuggestions ? { substitution_suggestions: substitutionSuggestions } : {}),
      };
    } catch (error: any) {
      this.logger.warn(`CDSS guidelines unavailable: ${error.message}`);
      if (this.whoSmartGuidelinesService) {
        try {
          const whoGuidelines = await this.whoSmartGuidelinesService.getRecommendations(condition, patientData);
          if (whoGuidelines && whoGuidelines.length > 0) {
            this.logger.log(`Using WHO Smart Guidelines fallback for: ${condition}`);
            return {
              guidelines: whoGuidelines.map(g => ({
                title: g.title,
                description: g.description,
                source: 'WHO Smart Guidelines',
                priority: g.priority
              })),
              recommendations: whoGuidelines.map(g => g.description),
              contraindications: [],
              medication_warnings: [],
              evidence_level: 'high',
              matched_condition: condition,
              source: 'who_smart_guidelines',
              knowledge_metadata: {
                source_name: 'WHO Smart Guidelines',
                source_version: 'fhir-local',
                fallback_used: true,
              },
              whoGuidelines: whoGuidelines
            };
          }
        } catch (whoError: any) {
          this.logger.debug(`WHO Smart Guidelines fallback unavailable: ${whoError.message}`);
        }
      }
      return this.basicGetGuidelines(condition);
    }
  }

  /**
   * Search for clinical guidelines using RAG and WHO Smart Guidelines
   */
  async searchGuidelines(query: string, limit: number = 5, patientContext?: any, tenantId?: string, tenantDb?: DataSource) {
    const results = {
      query,
      citations: [],
      analysis: null as string | null,
      count: 0,
      error: null,
      governed_corpus_used: false,
    };

    try {
      // 1. Search governed CDSS knowledge layer
      // Timeout is higher than other calls because the CDSS RAG + optional LLM synthesis
      // can take up to 45 s when the local LLM (Ollama) is cold. Configured via
      // CDSS_GUIDELINES_SEARCH_TIMEOUT_MS env var (default 50 s).
      const guidelinesTimeoutMs = this.parsePositiveInt(
        process.env.CDSS_GUIDELINES_SEARCH_TIMEOUT_MS,
        50000,
      );
      try {
        const responseData = await this.postWithPolicy<any>(
          'guidelines_search',
          '/guidelines/search',
          {
          query,
          limit,
          patient_context: patientContext,
          specialty: patientContext?.specialty || null,
          module: patientContext?.module || null,
          },
          guidelinesTimeoutMs,
          tenantId,
        );
        await this.recordGovernedPromptAudit({
          tenantDb,
          tenantId,
          useCase: 'cdss_guidelines_search',
          source: 'cdss_service',
          model: String(responseData?.model || 'guidelines_search_proxy'),
          patientId: patientContext?.patientId || null,
          encounterId: patientContext?.encounterId || null,
          requestBody: {
            query,
            limit,
            patientContextKeys: Object.keys(patientContext || {}).sort(),
            specialty: patientContext?.specialty || null,
            module: patientContext?.module || null,
          },
          responseSummary: {
            citationCount: Array.isArray(responseData?.citations) ? responseData.citations.length : 0,
            abstained: responseData?.abstained === true,
          },
          governance: responseData?.governance || {},
        });
        if (responseData && typeof responseData.analysis === 'string' && responseData.analysis.trim()) {
          results.analysis = responseData.analysis;
        }
        if (responseData && responseData.citations) {
          results.citations.push(...responseData.citations.map((c: any) => ({
            ...c,
            confidence: c.confidence ?? c.score ?? null,
            metadata: {
              ...(c.metadata || {}),
              source_version: c.source_version ?? c.metadata?.source_version ?? null,
              reviewed_at: c.reviewed_at ?? c.metadata?.reviewed_at ?? null,
              effective_date: c.effective_date ?? c.metadata?.effective_date ?? null,
              source_scope:
                c.metadata?.source_scope ??
                (c.metadata?.tenant_source ? 'tenant' : c.metadata?.governed_source ? 'shared' : undefined),
            },
          })));
        }
      } catch (error: any) {
        this.logger.warn(`CDSS guideline search failed: ${error.message}`);
      }

      // 2. Add WHO local search as fallback/supplementary source
      if (this.whoSmartGuidelinesService) {
        try {
          const whoResults = await this.whoSmartGuidelinesService.search(query);
          if (whoResults.length > 0) {
            results.citations.push(...whoResults.map(r => ({
              title: r.title,
              text: r.description || r.title,
              source: r.source,
              url: null,
              score: 1.0,
              metadata: {
                governed_source: true,
                source_version: 'fhir-local',
                source_scope: 'shared',
                freshness_status: 'fresh',
              },
            confidence: 1.0,
            })));
          }
        } catch (err: any) {
          this.logger.warn(`WHO Smart Guidelines search failed: ${err.message}`);
        }
      }
      
      // If no results found (either from WHO or CDSS), use fallback
      if (results.citations.length === 0) {
        this.logger.log('No guidelines found from external sources, using basic fallback');
        const fallback = this.basicSearchGuidelines(query);
        results.citations = fallback.citations;
      }
      
      results.count = results.citations.length;
      results.governed_corpus_used = results.citations.some((citation: any) => citation?.metadata?.governed_source);
      return results;
      
    } catch (error: any) {
      this.logger.error(`Unexpected error in searchGuidelines: ${error.message}`);
      return {
        query,
        citations: [],
        count: 0,
        error: error.message
      };
    }
  }

  async analyzeMedicalImage(file: Express.Multer.File, tenantId?: string) {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'medical-image.bin',
      contentType: file.mimetype || 'application/octet-stream',
    });

    const headers: Record<string, string> = {
      ...(formData.getHeaders() as Record<string, string>),
    };
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const startedAt = Date.now();
    try {
      const response = await this.requestWithPolicy<any>(
        'POST',
        'analyze_image',
        '/analyze-image',
        formData,
        45000,
        tenantId,
        { headers },
      );
      const durationSeconds = (Date.now() - startedAt) / 1000;
      this.metricsService?.recordCdssHook('analyze_image', 'success', durationSeconds, tenantId);
      this.onCdssCallSuccess();
      return response;
    } catch (error: any) {
      const durationSeconds = (Date.now() - startedAt) / 1000;
      const errorType = this.classifyCdssError(error);
      this.metricsService?.recordCdssHook('analyze_image', 'error', durationSeconds, tenantId);
      this.metricsService?.recordCdssHookError('analyze_image', errorType, tenantId);
      this.onCdssCallFailure();
      throw error;
    }
  }

  async patientSummarize(
    payload: {
      patientId?: string;
      patientName?: string;
      dob?: string | Date | null;
      gender?: string;
      clinicalNotes?: string[];
      recentVitals?: Record<string, any>;
      age?: number;
      encounterId?: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<PatientSummarizationResponse> {
    const responseData = await this.postWithPolicy<any>(
      'patient_summarize',
      '/patient/summarize',
      {
        patient_id: payload.patientId,
        patient_name: payload.patientName,
        dob: payload.dob,
        gender: payload.gender,
        clinical_notes: payload.clinicalNotes || [],
        recent_vitals: payload.recentVitals || {},
        age: payload.age,
      },
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'cdss_patient_summarize',
      source: 'cdss_service',
      model: String(responseData?.model || 'patient_summarization_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.encounterId || null,
      requestBody: {
        hasPatientIdentity: !!payload.patientName,
        clinicalNoteCount: Array.isArray(payload.clinicalNotes) ? payload.clinicalNotes.length : 0,
        hasRecentVitals: !!payload.recentVitals && Object.keys(payload.recentVitals).length > 0,
        age: payload.age ?? null,
        gender: payload.gender || null,
      },
      responseSummary: {
        summaryPresent: Boolean(
          responseData?.summary ||
          responseData?.one_liner ||
          responseData?.text ||
          responseData?.clinical_summary,
        ),
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async analyzeRegistrationDocument(
    payload: {
      documentType: string;
      extractedText: string;
      fileName?: string;
      mimeType?: string;
      language?: string;
      patientId?: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<RegistrationDocumentAnalysisResponse> {
    const responseData = await this.postWithPolicy<any>(
      'registration_document_analyze',
      '/registration/documents/analyze',
      {
        document_type: payload.documentType,
        extracted_text: payload.extractedText,
        file_name: payload.fileName,
        mime_type: payload.mimeType,
        language: payload.language || 'en',
        patient_id: payload.patientId,
      },
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'registration_document_intelligence',
      source: 'cdss_service',
      model: String(responseData?.model || 'registration_document_intelligence_proxy'),
      patientId: payload.patientId || null,
      requestBody: {
        documentType: payload.documentType,
        fileName: payload.fileName || null,
        mimeType: payload.mimeType || null,
        language: payload.language || 'en',
        extractedTextLength: payload.extractedText?.length || 0,
      },
      responseSummary: {
        fieldCount: Object.keys(responseData?.structured_payload || {}).length,
        flagCount: Array.isArray(responseData?.flags) ? responseData.flags.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      documentType: String(responseData?.document_type || payload.documentType || 'unknown'),
      structuredPayload: responseData?.structured_payload || {},
      summary: responseData?.summary || null,
      flags: Array.isArray(responseData?.flags) ? responseData.flags : [],
      confidence:
        responseData?.confidence === null || responseData?.confidence === undefined
          ? null
          : Number(responseData.confidence),
      model: responseData?.model || 'registration_document_intelligence_proxy',
      governance: responseData?.governance || {},
      abstained: responseData?.abstained === true,
      abstainReason: responseData?.abstain_reason || null,
    };
  }

  async requestGovernedJson(
    payload: {
      useCase: string;
      schemaDescription: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      templateVersion?: string;
      temperature?: number;
      sessionId?: string;
      patientId?: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<GovernedJsonCompletionResponse> {
    // Consent check — only for direct patient-context calls
    if (payload.patientId && tenantDb && this.patientConsentService) {
      await this.patientConsentService.requireAiConsent(payload.patientId, 'cdss_ai_processing', tenantDb);
    }

    const responseData = await this.postWithPolicy<any>(
      `governed_json_${payload.useCase}`,
      '/governed/json',
      {
        use_case: payload.useCase,
        schema_description: payload.schemaDescription,
        messages: payload.messages,
        template_version: payload.templateVersion || 'governed-json-v1',
        temperature: payload.temperature ?? 0.1,
        session_id: payload.sessionId || null,
        patient_id: payload.patientId || null,
      },
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: payload.useCase,
      source: 'cdss_service',
      model: String(responseData?.model || 'governed_json_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.sessionId || null,
      requestBody: {
        messageCount: payload.messages.length,
        schemaLength: payload.schemaDescription.length,
        templateVersion: payload.templateVersion || 'governed-json-v1',
      },
      responseSummary: {
        jsonKeys: Object.keys(responseData?.json || {}).length,
      },
      governance: responseData?.governance || {},
    });

    return {
      json: responseData?.json || {},
      model: String(responseData?.model || 'governed_json_proxy'),
      audit: responseData?.audit || {},
      governance: responseData?.governance || {},
    };
  }

  async ambientTranscriptionStream(
    payload: {
      sessionId: string;
      audioBase64: string;
      context?: Record<string, any>;
      patientId?: string;
      appointmentId?: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<AmbientTranscriptionStreamResponse> {
    const responseData = await this.postWithPolicy<any>(
      'ambient_transcription_stream',
      '/transcription/stream',
      {
        audio: payload.audioBase64,
        session_id: payload.sessionId,
        context: payload.context || {},
      },
      20000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'voice_soap_generation',
      source: 'cdss_service',
      model: String(responseData?.model || 'ambient_transcription_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.appointmentId || null,
      requestBody: {
        sessionId: payload.sessionId,
        audioLength: payload.audioBase64?.length || 0,
        contextKeys: Object.keys(payload.context || {}).sort(),
      },
      responseSummary: {
        transcriptPresent: Boolean(responseData?.transcript),
        diagnosisCount: Array.isArray(responseData?.entities?.diagnoses) ? responseData.entities.diagnoses.length : 0,
        orderCount: Array.isArray(responseData?.entities?.orders) ? responseData.entities.orders.length : 0,
        alertCount: Array.isArray(responseData?.entities?.alerts) ? responseData.entities.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      transcript: String(responseData?.transcript || ''),
      entities: {
        diagnoses: Array.isArray(responseData?.entities?.diagnoses) ? responseData.entities.diagnoses : [],
        medications: Array.isArray(responseData?.entities?.medications) ? responseData.entities.medications : [],
        allergies: Array.isArray(responseData?.entities?.allergies) ? responseData.entities.allergies : [],
        orders: Array.isArray(responseData?.entities?.orders) ? responseData.entities.orders : [],
        vitals: Array.isArray(responseData?.entities?.vitals) ? responseData.entities.vitals : [],
        alerts: Array.isArray(responseData?.entities?.alerts) ? responseData.entities.alerts : [],
      },
      draftNote: responseData?.draft_note || {},
      model: responseData?.model || 'ambient_transcription_proxy',
      abstained: responseData?.abstained === true,
      abstainReason: responseData?.abstain_reason || null,
      governance: responseData?.governance || {},
    };
  }

  async triageInboxItem(
    payload: {
      sourceType: string;
      title: string;
      content: string;
      patientId?: string;
      sourceId?: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<InboxTriageResponse> {
    const responseData = await this.postWithPolicy<any>(
      'inbox_triage',
      '/inbox/triage',
      {
        source_type: payload.sourceType,
        title: payload.title,
        content: payload.content,
        patient_id: payload.patientId,
      },
      10000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'inbox_triage',
      source: 'cdss_service',
      model: String(responseData?.triage_model || responseData?.model || 'inbox_triage_proxy'),
      patientId: payload.patientId || null,
      requestBody: {
        sourceType: payload.sourceType,
        sourceId: payload.sourceId || null,
        titleLength: payload.title?.length || 0,
        contentLength: payload.content?.length || 0,
      },
      responseSummary: {
        priority: responseData?.priority || 'routine',
        triageScore: Number(responseData?.triage_score || 0),
        hasDraftReply: Boolean(responseData?.draft_reply),
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      priority: responseData?.priority || 'routine',
      priority_reason: responseData?.priority_reason || 'Default triage.',
      triage_score: Number(responseData?.triage_score || 0),
      triage_model: String(responseData?.triage_model || responseData?.model || 'inbox_triage_proxy'),
      due_by_hours: responseData?.due_by_hours,
      draft_reply: responseData?.draft_reply,
      governance: responseData?.governance || {},
      abstained: responseData?.abstained === true,
    };
  }

  /**
   * Basic guideline search (fallback) — keyword-to-guideline mapping.
   * Returns key clinical points from local evidence base when CDSS is offline.
   */
  private basicSearchGuidelines(query: string) {
    const q = query.toLowerCase();

    const KEYWORD_MAP: Record<string, string[]> = {
      tuberculosis: [
        'New DS-TB: 2HRZE intensive phase + 4HR continuation (WHO 2022)',
        'DOT (Directly Observed Therapy) recommended for entire treatment course',
        'Screen all household contacts; offer LTBI treatment to contacts aged <5 or HIV+',
        'MDR-TB: refer to national MDR-TB programme immediately — do not treat empirically',
        'TB/HIV co-treatment: start ART within 2–8 weeks of TB treatment initiation',
      ],
      malaria: [
        'Uncomplicated falciparum malaria first-line: Artemether-Lumefantrine 6-dose over 3 days',
        'Take AL with food or milk for optimal absorption',
        'Severe malaria: IV Artesunate 2.4mg/kg at 0h, 12h, 24h then daily — admit to hospital',
        'Pregnant women first trimester: quinine + clindamycin; AL acceptable from second trimester',
        'Check G6PD before primaquine for P. vivax radical cure',
      ],
      hiv: [
        'Test and Treat: start ART same day as HIV diagnosis',
        'Preferred first-line Zimbabwe: TDF + 3TC + DTG (dolutegravir-based)',
        'Viral load at 6 months then annually if suppressed (<1000 copies/mL)',
        'Cotrimoxazole prophylaxis: all patients with CD4 <200 or WHO stage 3/4',
        'TB screening at every visit using W4SS (cough, fever, night sweats, weight loss)',
      ],
      hypertension: [
        'Target BP <140/90 for most adults; <130/80 for diabetes or CKD',
        'First-line: ACE inhibitor (or ARB) ± calcium channel blocker ± thiazide diuretic',
        'Lifestyle: low-sodium diet, exercise 150min/week, weight loss, limit alcohol',
        'Hypertensive emergency (BP ≥180/120 + organ damage): IV labetalol or nitroprusside',
        'Avoid ACE inhibitors/ARBs in pregnancy — use methyldopa or nifedipine SR',
      ],
      diabetes: [
        'Target HbA1c <7% for most; <8% for elderly with comorbidities',
        'First-line: Metformin 500mg BD with meals, titrate to 1000mg BD',
        'Annual: HbA1c, foot exam, eye exam, microalbuminuria, renal function, lipids',
        'Stop metformin if eGFR <30mL/min — renal dose adjustment required',
        'Add SGLT2 inhibitor or GLP-1 agonist if CVD or CKD present',
      ],
      sepsis: [
        'Hour-1 bundle: blood cultures x2, serum lactate, IV broad-spectrum antibiotics, 30ml/kg crystalloid',
        'IV antibiotics must be given within 1 hour of sepsis recognition',
        'Target MAP ≥65mmHg — start noradrenaline if fluids insufficient',
        'Lactate >4mmol/L = septic shock — ICU admission required',
        'Re-evaluate haemodynamic status at 1h and 3h after resuscitation',
      ],
      pneumonia: [
        'CURB-65 scoring: Confusion, Urea >7, RR >30, BP <90/60, Age >65',
        'CURB-65 0–1: outpatient amoxicillin 500mg TDS × 5 days',
        'CURB-65 ≥2: hospital admission, IV amoxicillin-clavulanate or ceftriaxone',
        'SpO2 target ≥94% — start O2 if below threshold',
        'HIV test in all pneumonia patients in Zimbabwe (Pneumocystis jirovecii risk)',
      ],
      cholera: [
        'Assess dehydration: WHO Plan A (mild), Plan B (moderate ORS), Plan C (severe IV Ringer\'s)',
        'Adults: ORS 75ml/kg over 4h for moderate dehydration',
        'Antibiotic: doxycycline 300mg single dose (adults); azithromycin for children/pregnant',
        'Zinc supplementation for children <5 years (10–20mg/day × 10–14 days)',
        'Isolation and case notification to district health office within 24h',
      ],
      heart_failure: [
        'HFrEF cornerstone: ACE inhibitor (or ARB) + beta-blocker + spironolactone',
        'Daily weight monitoring — escalate if >2kg gain over 2 days',
        'Furosemide for congestion — titrate to euvolaemia',
        'Fluid restriction <1.5L/day in decompensated HF',
        'Avoid NSAIDs, diltiazem/verapamil in HFrEF, thiazolidinediones, high-sodium diet',
      ],
    };

    const citations: Array<{ title: string; text: string; source: string; url: null; score: number; metadata: Record<string, any> }> = [];
    for (const [topic, points] of Object.entries(KEYWORD_MAP)) {
      if (q.includes(topic) || topic.split('_').some(w => q.includes(w))) {
        for (const point of points.slice(0, 3)) {
          citations.push({
            title: `${topic.replace(/_/g, ' ')} — key guideline point`,
            text: point,
            source: 'Local Clinical Guidelines (Fallback)',
            url: null,
            score: 0.75,
            metadata: {
              source_scope: 'fallback',
              freshness_status: 'fallback',
            },
          });
        }
      }
    }
    // Partial word match if no direct hit
    if (citations.length === 0) {
      for (const [topic, points] of Object.entries(KEYWORD_MAP)) {
        const words = q.split(/\s+/).filter(w => w.length > 3);
        if (words.some(w => topic.includes(w) || w.includes(topic.split('_')[0]))) {
          citations.push({
            title: `${topic.replace(/_/g, ' ')} — related guideline`,
            text: points[0],
            source: 'Local Clinical Guidelines (Fallback)',
            url: null,
            score: 0.4,
            metadata: {
              source_scope: 'fallback',
              freshness_status: 'fallback',
            },
          });
          break;
        }
      }
    }

    return {
      query,
      citations,
      count: citations.length,
      error: null,
      source: 'local_fallback',
      cdss_unavailable: true,
    };
  }

  /**
   * Basic guidelines (fallback) — curated local evidence-based guideline map.
   * Covers 10 conditions with highest clinical burden in Zimbabwe.
   */
  private async basicGetGuidelines(condition: string) {
    type GuidelineEntry = { title: string; source: string; recommendations: string[]; contraindications: Record<string, string> };
    const LOCAL_GUIDELINES: Record<string, GuidelineEntry> = {
      hypertension: {
        title: 'Hypertension Management',
        source: 'WHO/JNC 2023',
        recommendations: [
          'Target BP <140/90 for most adults; <130/80 for diabetes or CKD',
          'First-line: ACE inhibitor (or ARB) + thiazide diuretic ± calcium channel blocker',
          'Lifestyle modifications: low-sodium diet, exercise 150min/week, weight loss, limit alcohol',
          'Hypertensive urgency: oral amlodipine or captopril. Emergency (+ organ damage): IV labetalol',
          'Monitor BP every 4 weeks until controlled, then every 3–6 months',
        ],
        contraindications: { pregnancy: 'Avoid ACE inhibitors/ARBs. Use methyldopa or nifedipine SR.' },
      },
      tuberculosis: {
        title: 'TB Treatment — WHO 2022 Guidelines',
        source: 'WHO 2022 / MOHCC Zimbabwe',
        recommendations: [
          'New DS-TB: 2HRZE (intensive) / 4HR (continuation) — total 6 months',
          'DOT (Directly Observed Therapy) for entire treatment course',
          'Test for HIV at diagnosis — co-treatment required',
          'MDR-TB: refer to national MDR-TB programme — do not treat empirically',
          'Notify district TB coordinator within 3 days of diagnosis',
          'Contact tracing: screen all household contacts; offer LTBI treatment to <5 years or HIV+',
        ],
        contraindications: { liver_disease: 'Pyrazinamide and isoniazid — monitor LFTs. Withhold if transaminases >5× ULN.' },
      },
      malaria: {
        title: 'Malaria Treatment — Zimbabwe National Guidelines',
        source: 'MOHCC Zimbabwe 2023',
        recommendations: [
          'Uncomplicated falciparum: Artemether-Lumefantrine (AL) 6-dose over 3 days',
          'Take AL with food or milk for optimal absorption',
          'Severe/complicated: IV Artesunate 2.4mg/kg at 0h, 12h, 24h then daily — admit',
          'Treat severe anaemia (Hb <8g/dL) concurrently',
          'Pregnant women first trimester: quinine + clindamycin; AL acceptable from second trimester',
          'Check G6PD before primaquine for P. vivax radical cure',
        ],
        contraindications: { first_trimester: 'Avoid artemisinin combinations in first trimester. Use quinine + clindamycin.' },
      },
      hiv: {
        title: 'HIV/ART Management',
        source: 'WHO 2021 / MOHCC Zimbabwe',
        recommendations: [
          'Test and Treat: start ART same day as HIV diagnosis',
          'Preferred first-line: TDF + 3TC + DTG (dolutegravir-based)',
          'Viral load at 6 months, then annually if suppressed',
          'Cotrimoxazole prophylaxis: CD4 <200 or WHO stage 3/4',
          'TB screening at every visit (W4SS: cough, fever, night sweats, weight loss)',
          'Isoniazid Preventive Therapy (IPT) for all HIV+ without active TB',
        ],
        contraindications: { pregnancy: 'TDF + 3TC + DTG preferred in pregnancy. Discuss efavirenz risks in first trimester.' },
      },
      diabetes: {
        title: 'Type 2 Diabetes Management',
        source: 'ADA 2024',
        recommendations: [
          'Target HbA1c <7% for most; <8% for elderly/complex comorbidities',
          'First-line: Metformin 500mg BD with meals, titrate to 1000mg BD',
          'Add SGLT2 inhibitor or GLP-1 agonist if CVD or CKD present',
          'Monitor: HbA1c q3–6mo until stable, then annually; foot exam, eye exam, microalbuminuria, renal function annually',
          'Lifestyle: low glycaemic diet, 150min moderate exercise/week',
        ],
        contraindications: { renal_impairment: 'Stop metformin if eGFR <30mL/min. Contrast dye: hold metformin 48h before and after.' },
      },
      pneumonia: {
        title: 'Community-Acquired Pneumonia',
        source: 'WHO/BTS Guidelines',
        recommendations: [
          'Assess severity with CURB-65 (Confusion, Urea >7, RR >30, BP <90/60, Age >65)',
          'CURB-65 0–1: outpatient amoxicillin 500mg TDS × 5 days',
          'CURB-65 ≥2: hospital admission, IV amoxicillin-clavulanate or ceftriaxone',
          'CURB-65 3–5: consider ICU, broad-spectrum IV antibiotics',
          'SpO2 target ≥94% — start O2 if below threshold',
          'HIV test in all hospitalised pneumonia patients in Zimbabwe',
        ],
        contraindications: { penicillin_allergy: 'Mild CAP: azithromycin monotherapy or doxycycline.' },
      },
      sepsis: {
        title: 'Sepsis Management — Surviving Sepsis Campaign',
        source: 'SSC 2021',
        recommendations: [
          'Hour-1 Bundle: blood cultures ×2, serum lactate, IV broad-spectrum antibiotics, 30ml/kg crystalloid',
          'IV antibiotics within 1 hour of recognition',
          'Target MAP ≥65mmHg — noradrenaline if fluids insufficient',
          'Lactate >4mmol/L = septic shock — ICU admission required',
          'Re-assess at 1h and 3h post-resuscitation',
        ],
        contraindications: {},
      },
      heart_failure: {
        title: 'Heart Failure Management',
        source: 'ESC/ACC 2022',
        recommendations: [
          'HFrEF: ACE inhibitor + beta-blocker + spironolactone as cornerstone',
          'Daily weight monitoring — escalate if >2kg in 2 days',
          'Furosemide for congestion — titrate to euvolaemia',
          'Fluid restriction <1.5L/day in decompensated HF',
          'Avoid NSAIDs, CCBs (diltiazem/verapamil), thiazolidinediones, high-sodium diet',
        ],
        contraindications: { hypotension: 'Hold ACE inhibitor/ARB if systolic BP <90mmHg.' },
      },
      asthma: {
        title: 'Asthma Management — GINA 2024',
        source: 'GINA 2024',
        recommendations: [
          'Low-dose ICS (budesonide 200–400mcg/day) + SABA PRN for steps 1–2',
          'Low-dose ICS-LABA maintenance for step 3',
          'Acute exacerbation: salbutamol 4–8 puffs q20min × 3, systemic corticosteroids',
          'SpO2 <92% or severe: hospital admission, O2, IV magnesium sulfate 2g over 20min',
          'Assess and avoid triggers: dust, smoke, aspirin/NSAIDs, cold air',
        ],
        contraindications: { pregnancy: 'Preferred ICS in pregnancy: budesonide. SABAs are safe.' },
      },
      copd: {
        title: 'COPD Management — GOLD 2024',
        source: 'GOLD 2024',
        recommendations: [
          'Smoking cessation — single most important intervention',
          'SABA (salbutamol) for symptom relief; add LAMA (tiotropium) for persistent symptoms',
          'LAMA + LABA for breathlessness despite monotherapy',
          'ICS-containing regimens for ≥2 exacerbations/year or ≥1 hospitalisation',
          'Annual influenza vaccination; pneumococcal vaccination',
        ],
        contraindications: {},
      },
    };

    const key = condition.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const guideline = LOCAL_GUIDELINES[key] ?? Object.entries(LOCAL_GUIDELINES).find(([k]) => key.includes(k) || k.includes(key.split('_')[0]))?.[1];

    if (guideline) {
      return {
        guidelines: [{ condition, guidelines: guideline.recommendations }],
        recommendations: guideline.recommendations,
        contraindications: Object.entries(guideline.contraindications).map(([k, v]) => `${k}: ${v}`),
        medication_warnings: [],
        evidence_level: 'high',
        matched_condition: condition,
        source: 'local_fallback',
        cdss_unavailable: true,
        warning: 'CDSS service unavailable. Showing local evidence-based guidelines. Verify with current national protocols.',
      };
    }

    return {
      guidelines: [{ condition, guidelines: ['No local guideline found. Consult current national protocols or UpToDate.'] }],
      recommendations: ['Consult current national treatment protocols for this condition.'],
      contraindications: [],
      medication_warnings: [],
      evidence_level: 'unknown',
      matched_condition: condition,
      source: 'local_fallback_empty',
      cdss_unavailable: true,
    };
  }

  /**
   * Risk assessment using Python CDSS service with historical data
   */
  async riskAssessment(patientData: any, tenantDb?: DataSource, tenantId?: string) {
    try {
      const { patientId, age, gender, vitals, medicalHistory, medications, diagnoses, labResults } = patientData;
      const normalizedDiagnoses = Array.isArray(diagnoses || medicalHistory)
        ? (diagnoses || medicalHistory).map((entry: any) => {
            if (typeof entry === 'string') return entry;
            return String(entry?.name || entry?.description || entry?.code || 'unknown');
          })
        : [];
      const normalizedMedications = Array.isArray(medications)
        ? medications.map((entry: any) => {
            if (typeof entry === 'string') return entry;
            return String(entry?.name || entry?.drug_name || entry?.medication || 'unknown');
          })
        : [];

      // Structured SNOMED observations captured with the vitals (e.g. ACS,
      // severe sepsis) are treated as active clinical findings. Merge them into
      // the diagnoses the risk engine already reasons over so they influence the
      // assessment, and pass them through explicitly for downstream use.
      const clinicalFindings: string[] = Array.isArray(patientData?.clinicalFindings)
        ? patientData.clinicalFindings.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        : [];
      for (const finding of clinicalFindings) {
        if (!normalizedDiagnoses.includes(finding)) normalizedDiagnoses.push(finding);
      }
      
      // Fetch historical data if database connection available
      let historicalData: any = {};
      
      // Always try to fetch historical data if we have tenantDb and patientId
      if (tenantDb && patientId) {
        try {
          historicalData = await this.fetchPatientHistory(patientId, tenantDb);
        } catch (error: any) {
          this.logger.error(`[CDSS] ❌ ERROR in fetchPatientHistory: ${error.message}`);
        }
      } else {
        historicalData = {
          totalVisits: 0,
          totalVitals: 0,
          historicalVitals: [],
          visitHistory: [],
          daysSinceLastVisit: null
        };
      }
      
      // Format vitals for CDSS service with historical context
      const formattedVitals: any = {
        ...vitals,
        age: age || vitals?.age,
        patient_age: age || vitals?.patient_age,
        gender: gender || vitals?.gender,
        patient_gender: gender || vitals?.patient_gender,
        // Add historical visit data
        previousAdmissions: historicalData.previousAdmissions || 0,
        edVisits: historicalData.edVisits || 0,
        totalVisits: historicalData.totalVisits || 0,
        daysSinceLastVisit: historicalData.daysSinceLastVisit || null,
      };

      const requestPayload: any = {
        patient_id: patientId || 'unknown',
        vitals: formattedVitals,
        medications: normalizedMedications,
        diagnoses: normalizedDiagnoses,
        clinical_findings: clinicalFindings,
        lab_results: labResults,
        context: patientData?.context || null,
        specialty: patientData?.specialty || null,
        module: patientData?.module || null,
        patient_context: {
          age: age || null,
          gender: gender || null,
          specialty: patientData?.specialty || null,
          module: patientData?.module || null,
          is_pregnant:
            patientData?.isPregnant === true ||
            patientData?.pregnant === true ||
            String(patientData?.pregnancyStatus || '').toLowerCase() === 'pregnant',
        },
      };

      // Add historical data for trend analysis if available
      if (historicalData.historicalVitals && historicalData.historicalVitals.length > 0) {
        requestPayload.historical_vitals = historicalData.historicalVitals;
      }
      if (historicalData.visitHistory && historicalData.visitHistory.length > 0) {
        requestPayload.visit_history = historicalData.visitHistory;
      }

      const responseData = await this.postWithPolicy<any>(
        'risk_assessment',
        '/risk/calculate',
        requestPayload,
        15000,
        tenantId,
      );

      // Merge trend analysis if available
      const result: any = {
        overall_score: responseData.overall_score,
        risk_level: responseData.risk_level,
        factors: responseData.factors || [],
        recommendations: responseData.recommendations || [],
        guideline_citations: responseData.guideline_citations || [],
        source: 'advanced_cdss',
      };

      // Phase-0 safety governor passthrough — the deterministic acute-deterioration
      // synthesis + override must reach the UI (otherwise the governed output is lost).
      if (responseData.acute_safety) result.acute_safety = responseData.acute_safety;
      if (responseData.governor_banner) result.governor_banner = responseData.governor_banner;
      if (responseData.readmission_assessment) result.readmission_assessment = responseData.readmission_assessment;
      if (responseData.risk_model_conflict !== undefined) result.risk_model_conflict = responseData.risk_model_conflict;

      // Add historical context
      if (historicalData.totalVisits > 0) {
        result.historical_context = {
          total_visits: historicalData.totalVisits,
          days_since_last_visit: historicalData.daysSinceLastVisit,
          previous_admissions: historicalData.previousAdmissions,
          ed_visits: historicalData.edVisits,
        };
      }

      // Add trend analysis if available
      if (responseData.trends) {
        result.trends = responseData.trends;
      }
      
      // Add visit patterns if available
      if (responseData.visit_patterns) {
        result.visit_patterns = responseData.visit_patterns;
      }

      return result;
    } catch (error: any) {
      this.logger.warn(`CDSS risk assessment unavailable: ${error.message}`);
      // Fallback to basic risk assessment
      return this.basicRiskAssessment(patientData);
    }
  }

  /**
   * Deterministic clinical-safety synthesis (NEWS2-aware qSOFA/SIRS/DKA/pain + syndrome
   * alerts + acute state). Single source of truth for the Safety Alerts surfaces.
   */
  async evaluateClinicalSafety(
    vitals: Record<string, any>,
    tenantId?: string,
    alteredMentation = false,
  ): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'risk_assessment',
      '/clinical/safety-eval',
      { vitals: vitals || {}, altered_mentation: alteredMentation },
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async cervicalCancerScreenRecommend(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'cervicalCancerScreenRecommend',
      '/cdss/cervical-cancer/screen-recommend',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async familyPlanningMethodEligibility(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'familyPlanningMethodEligibility',
      '/cdss/family-planning/method-eligibility',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async familyPlanningMethods(tenantId?: string): Promise<Record<string, any>> {
    return this.getWithPolicy<Record<string, any>>(
      'familyPlanningMethods',
      '/cdss/family-planning/methods',
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async htnStepTherapy(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'htnStepTherapy',
      '/cdss/htn/step-therapy',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async htnCvdRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'htnCvdRisk',
      '/cdss/htn/cvd-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async tmHdiCheck(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'tmHdiCheck',
      '/cdss/tm/hdi-check',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async tmToxicityRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'tmToxicityRisk',
      '/cdss/tm/toxicity-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async culturalSdohRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'culturalSdohRisk',
      '/cdss/cultural/sdoh-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async culturalUbuntuPsychosocial(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'culturalUbuntuPsychosocial',
      '/cdss/cultural/ubuntu-psychosocial',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async scdHydroxyureaDose(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'scdHydroxyureaDose',
      '/cdss/scd/hydroxyurea-dose',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async scdCrisisTriage(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'scdCrisisTriage',
      '/cdss/scd/crisis-triage',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async scdComplicationRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'scdComplicationRisk',
      '/cdss/scd/complication-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async epilepsyAedDose(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'epilepsyAedDose',
      '/cdss/epilepsy/aed-dose',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async epilepsyDrugInteractions(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'epilepsyDrugInteractions',
      '/cdss/epilepsy/drug-interactions',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async epilepsyStatusEpilepticus(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'epilepsyStatusEpilepticus',
      '/cdss/epilepsy/status-epilepticus',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async vhfRiskTriage(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'vhfRiskTriage',
      '/cdss/vhf/risk-triage',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async mpoxSeverity(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'mpoxSeverity',
      '/cdss/vhf/mpox-severity',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async zoonoticAssess(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'zoonoticAssess',
      '/cdss/zoonotic/assess',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async surveillanceIhrAnnex2(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'surveillanceIhrAnnex2',
      '/cdss/surveillance/ihr-annex2',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async surveillanceEbsTriage(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'surveillanceEbsTriage',
      '/cdss/surveillance/ebs-triage',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async cbhiClaimAdjudication(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'cbhiClaimAdjudication',
      '/cdss/cbhi/claim-adjudication',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async tbaSupervisionRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'tbaSupervisionRisk',
      '/cdss/tba/supervision-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async homeBirthRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'homeBirthRisk',
      '/cdss/tba/home-birth-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async crossBorderContinuity(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'crossBorderContinuity',
      '/cdss/interop/cross-border-continuity',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async maternalEmoncClassify(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'maternalEmoncClassify',
      '/cdss/maternal/emonc-classify',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async maternalDeathAuditReview(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'maternalDeathAuditReview',
      '/cdss/maternal/death-audit-review',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async ncdDiabeticFootRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'ncdDiabeticFootRisk',
      '/cdss/ncd/diabetic-foot-risk',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  async ncdCkdManagement(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
    return this.requestWithPolicy<Record<string, any>>(
      'POST',
      'ncdCkdManagement',
      '/cdss/ncd/ckd-management',
      payload,
      this.defaultTimeoutMs,
      tenantId,
    );
  }

  /**
   * Fetch patient historical data for CDSS analysis
   */
  /**
   * Interpret lab results
   */
  async interpretLabResults(labResults: any, historicalLabs?: any[]) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'labs_interpret',
        '/labs/interpret',
        {
        lab_results: labResults,
        historical_labs: historicalLabs || []
        },
        15000,
      );
      return responseData;
    } catch (error: any) {
      this.logger.warn(`CDSS lab interpretation unavailable: ${error.message}`);
      return {
        interpretations: [],
        summary: { total_tests: 0, normal: 0, abnormal: 0, critical: 0 },
        critical_alerts: [],
        warnings: ['CDSS service unavailable - results not interpreted'],
        recommendations: ['Manual interpretation required'],
        source: 'error'
      };
    }
  }

  /**
   * Detect duplicate therapy
   */
  async detectDuplicateTherapy(medications: any[], prescriptions?: any[]) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'medication_duplicates',
        '/medications/duplicates',
        {
        medications,
        prescriptions: prescriptions || []
        },
        15000,
      );
      return responseData;
    } catch (error: any) {
      this.logger.warn(`CDSS duplicate therapy detection unavailable: ${error.message}`);
      return this.localDuplicateTherapyCheck([...medications, ...(prescriptions || [])]);
    }
  }

  private localDuplicateTherapyCheck(allMeds: any[]) {
    // Therapeutic class groupings for duplicate/concurrent-class detection
    const DRUG_CLASSES: Record<string, string[]> = {
      nsaid: ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin', 'meloxicam', 'celecoxib', 'piroxicam', 'ketorolac', 'mefenamic'],
      ace_inhibitor: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril', 'quinapril', 'fosinopril', 'benazepril'],
      arb: ['losartan', 'valsartan', 'irbesartan', 'candesartan', 'olmesartan', 'telmisartan'],
      beta_blocker: ['atenolol', 'metoprolol', 'propranolol', 'bisoprolol', 'carvedilol', 'nebivolol', 'labetalol'],
      statin: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'fluvastatin', 'lovastatin'],
      opioid: ['morphine', 'codeine', 'tramadol', 'oxycodone', 'fentanyl', 'pethidine', 'buprenorphine', 'hydrocodone'],
      benzodiazepine: ['diazepam', 'lorazepam', 'clonazepam', 'alprazolam', 'midazolam', 'temazepam', 'nitrazepam', 'oxazepam'],
      ssri: ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'],
      sulfonyl_urea: ['glibenclamide', 'glipizide', 'gliclazide', 'glimepiride', 'tolbutamide', 'gliquidone'],
      fluoroquinolone: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin', 'norfloxacin'],
      arv_nnrti: ['efavirenz', 'nevirapine', 'rilpivirine', 'doravirine', 'etravirine'],
      arv_nrti: ['tenofovir', 'lamivudine', 'emtricitabine', 'zidovudine', 'abacavir', 'stavudine'],
      arv_insti: ['dolutegravir', 'raltegravir', 'elvitegravir', 'bictegravir', 'cabotegravir'],
    };

    const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const extractName = (m: any): string =>
      normalize(m?.name ?? m?.medication_name ?? m?.medicationName ?? m?.drug ?? '');

    const names = allMeds.map(extractName).filter(Boolean);

    const duplicates: any[] = [];
    const classHits: Record<string, string[]> = {};

    // Exact name duplicates
    const nameCount: Record<string, number> = {};
    for (const n of names) nameCount[n] = (nameCount[n] ?? 0) + 1;
    for (const [name, count] of Object.entries(nameCount)) {
      if (count > 1) {
        duplicates.push({
          type: 'exact_duplicate',
          drug: name,
          count,
          severity: 'major',
          message: `Duplicate prescription: ${name} appears ${count} times`,
          recommendation: `Review and consolidate duplicate ${name} prescriptions`,
        });
      }
    }

    // Therapeutic class duplicates
    for (const [className, drugs] of Object.entries(DRUG_CLASSES)) {
      const matches = names.filter(n => drugs.some(d => n.includes(normalize(d)) || normalize(d).includes(n)));
      if (matches.length > 1) classHits[className] = matches;
    }
    for (const [className, matches] of Object.entries(classHits)) {
      // ACE + ARB is a known dangerous combination (not just duplicate class)
      if (className === 'arb' && classHits['ace_inhibitor']) continue; // handled below
      duplicates.push({
        type: 'same_class',
        drugClass: className.replace('_', ' '),
        drugs: matches,
        severity: className === 'opioid' || className === 'benzodiazepine' ? 'major' : 'moderate',
        message: `Multiple ${className.replace(/_/g, ' ')} agents: ${matches.join(', ')}`,
        recommendation: `Review concurrent ${className.replace(/_/g, ' ')} use — generally avoid duplicate class prescriptions`,
      });
    }
    // ACE + ARB combination (dual RAAS blockade)
    if (classHits['ace_inhibitor'] && classHits['arb']) {
      duplicates.push({
        type: 'dangerous_class_combination',
        drugClass: 'dual_raas_blockade',
        drugs: [...classHits['ace_inhibitor'], ...classHits['arb']],
        severity: 'major',
        message: `ACE inhibitor + ARB combination (dual RAAS blockade) — risk of AKI and hyperkalemia`,
        recommendation: 'Avoid dual RAAS blockade. Use one agent only per ONTARGET trial evidence.',
      });
    }

    return {
      has_duplicates: duplicates.length > 0,
      duplicates,
      warnings: duplicates.length === 0 ? [] : ['Duplicate therapy detected — review prescriptions'],
      summary: { total_medications: allMeds.length, duplicate_count: duplicates.length },
      source: 'local_fallback',
      cdss_unavailable: true,
    };
  }

  /**
   * Check high-risk medications
   */
  async checkHighRiskMedications(
    medications: any[],
    patientAge?: number,
    patientGender?: string,
    diagnoses?: string[],
    renalFunction?: number
  ) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'medication_high_risk',
        '/medications/high-risk',
        {
        medications,
        patient_age: patientAge,
        patient_gender: patientGender,
        diagnoses: diagnoses || [],
        renal_function: renalFunction
        },
        15000,
      );
      return responseData;
    } catch (error: any) {
      this.logger.warn(`CDSS high-risk medication check unavailable: ${error.message}`);
      return this.localHighRiskMedicationCheck(medications, patientAge, patientGender, renalFunction);
    }
  }

  private localHighRiskMedicationCheck(
    medications: any[],
    patientAge?: number,
    patientGender?: string,
    renalFunction?: number,
  ) {
    const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const names = medications.map(m =>
      normalize(m?.name ?? m?.medication_name ?? m?.medicationName ?? m?.drug ?? ''),
    ).filter(Boolean);

    const high_alert_medications: any[] = [];
    const beers_criteria_alerts: any[] = [];
    const renal_alerts: any[] = [];

    // WHO high-alert medications (ISMP list) — severe harm potential
    const WHO_HIGH_ALERT: Array<{ drug: string; alert: string; recommendation: string }> = [
      { drug: 'warfarin', alert: 'Anticoagulant — high bleeding risk. Narrow therapeutic index.', recommendation: 'Monitor INR regularly. Review concurrent medications for interactions.' },
      { drug: 'heparin', alert: 'Anticoagulant — IV heparin errors cause fatal haemorrhage.', recommendation: 'Use weight-based protocols. Verify dose independently before administration.' },
      { drug: 'insulin', alert: 'High-alert: insulin errors cause severe hypoglycaemia.', recommendation: 'Double-check dose, type, and route. Use insulin-specific syringes.' },
      { drug: 'digoxin', alert: 'Narrow therapeutic index. Toxicity risk with hypokalaemia.', recommendation: 'Monitor digoxin levels, renal function, and potassium. Target 0.5–0.9 ng/mL.' },
      { drug: 'lithium', alert: 'Narrow therapeutic index. Toxicity with dehydration or NSAIDs.', recommendation: 'Monitor lithium levels every 3–6 months. Avoid NSAIDs and ACE inhibitors.' },
      { drug: 'methotrexate', alert: 'Cytotoxic at high doses. Fatal errors documented with daily instead of weekly dosing.', recommendation: 'Confirm weekly dosing for non-oncology use. Avoid NSAIDs.' },
      { drug: 'morphine', alert: 'Opioid — respiratory depression risk. High diversion potential.', recommendation: 'Start low, titrate. Monitor respiratory rate. Naloxone available.' },
      { drug: 'fentanyl', alert: 'Potent opioid — 100× morphine potency. Patch errors cause fatalities.', recommendation: 'Patch: no cutting, no heat exposure. IV: dose in micrograms, not milligrams.' },
      { drug: 'potassium', alert: 'Concentrated potassium IV — cardiac arrest risk if given undiluted.', recommendation: 'Never give undiluted IV bolus. Max 20 mmol/h peripheral, 40 mmol/h central.' },
      { drug: 'amiodarone', alert: 'Multiple organ toxicities (pulmonary, thyroid, hepatic, corneal). Many drug interactions.', recommendation: 'Annual TFT, LFT, CXR. Review all concurrent medications for interactions.' },
      { drug: 'cyclophosphamide', alert: 'Cytotoxic — bone marrow suppression, haemorrhagic cystitis.', recommendation: 'Adequate hydration. Monitor FBC. Mesna for haemorrhagic cystitis prevention.' },
      { drug: 'phenytoin', alert: 'Narrow therapeutic index. Non-linear pharmacokinetics.', recommendation: 'Monitor phenytoin levels. Many drug interactions — review concurrent medications.' },
    ];

    for (const entry of WHO_HIGH_ALERT) {
      const key = normalize(entry.drug);
      if (names.some(n => n.includes(key) || key.includes(n))) {
        high_alert_medications.push({
          drug: entry.drug,
          category: 'who_high_alert',
          alert: entry.alert,
          recommendation: entry.recommendation,
        });
      }
    }

    // Beers criteria (AGS 2023) — medications potentially inappropriate in adults ≥65
    if (patientAge !== undefined && patientAge >= 65) {
      const BEERS: Array<{ drug: string; concern: string; recommendation: string }> = [
        { drug: 'ibuprofen', concern: 'NSAIDs: GI bleeding, renal impairment, fluid retention in older adults.', recommendation: 'Avoid NSAIDs in ≥65 unless alternatives inadequate. Use PPI if NSAID required.' },
        { drug: 'naproxen', concern: 'NSAID — same Beers concerns as ibuprofen.', recommendation: 'Avoid in older adults. Paracetamol preferred for pain.' },
        { drug: 'diclofenac', concern: 'NSAID — Beers criteria. Cardiovascular and renal risk in elderly.', recommendation: 'Avoid. Consider topical diclofenac for localised pain.' },
        { drug: 'diazepam', concern: 'Benzodiazepine — fall and fracture risk, cognitive impairment, paradoxical excitation in elderly.', recommendation: 'Avoid. If insomnia: CBT-I first. If anxiety: SSRI. Taper existing BZDs slowly.' },
        { drug: 'lorazepam', concern: 'Benzodiazepine — Beers criteria: increased fall risk and cognitive decline in ≥65.', recommendation: 'Avoid. Consider buspirone or low-dose SSRI for anxiety.' },
        { drug: 'amitriptyline', concern: 'Tricyclic antidepressant — anticholinergic, sedating, QT prolonging. Beers criteria.', recommendation: 'Avoid for depression. SSRI preferred. Use low-dose for neuropathic pain only if necessary.' },
        { drug: 'chlorpheniramine', concern: 'First-gen antihistamine — anticholinergic (confusion, urinary retention, dry mouth) in elderly.', recommendation: 'Use non-sedating antihistamine (loratadine, cetirizine) instead.' },
        { drug: 'promethazine', concern: 'Anticholinergic antihistamine — Beers criteria. High fall and confusion risk in ≥65.', recommendation: 'Avoid. Use prochlorperazine cautiously for nausea or metoclopramide short-term.' },
        { drug: 'digoxin', concern: 'Avoid >0.125mg/day in ≥65 — reduced renal clearance raises toxicity risk.', recommendation: 'Target 0.0625–0.125mg/day in older adults. Monitor levels and renal function.' },
        { drug: 'amiodarone', concern: 'Thyroid toxicity risk higher in elderly. Many interactions.', recommendation: 'Use sotalol or dronedarone as alternatives for AF where possible.' },
        { drug: 'glibenclamide', concern: 'Long-acting sulphonylurea — prolonged hypoglycaemia risk in elderly with erratic eating.', recommendation: 'Use shorter-acting gliclazide or non-sulphonylurea agent.' },
      ];

      for (const entry of BEERS) {
        const key = normalize(entry.drug);
        if (names.some(n => n.includes(key) || key.includes(n))) {
          beers_criteria_alerts.push({
            drug: entry.drug,
            concern: entry.concern,
            recommendation: entry.recommendation,
            criteria: 'AGS_Beers_2023',
          });
        }
      }
    }

    // Renal dosing flags — when renalFunction (eGFR) is low
    if (renalFunction !== undefined && renalFunction < 45) {
      const RENAL_ADJUST: Array<{ drug: string; eGFRThreshold: number; concern: string; recommendation: string }> = [
        { drug: 'metformin', eGFRThreshold: 30, concern: 'Lactic acidosis risk when eGFR <30.', recommendation: 'Withhold metformin if eGFR <30 mL/min. Halve dose if eGFR 30–45.' },
        { drug: 'ibuprofen', eGFRThreshold: 45, concern: 'NSAIDs reduce GFR — can precipitate AKI in CKD.', recommendation: 'Avoid NSAIDs if eGFR <45. Use paracetamol.' },
        { drug: 'naproxen', eGFRThreshold: 45, concern: 'NSAID — nephrotoxic in CKD.', recommendation: 'Avoid if eGFR <45.' },
        { drug: 'digoxin', eGFRThreshold: 45, concern: 'Digoxin renally cleared — accumulation risk in CKD.', recommendation: 'Reduce dose 50% if eGFR 30–45. Avoid if eGFR <30 or use with close monitoring.' },
        { drug: 'lithium', eGFRThreshold: 45, concern: 'Lithium renally excreted — toxicity in CKD.', recommendation: 'Reduce dose. Monitor lithium levels frequently. Avoid if eGFR <30.' },
        { drug: 'tenofovir', eGFRThreshold: 50, concern: 'TDF is nephrotoxic — renal tubular dysfunction.', recommendation: 'Use TAF (tenofovir alafenamide) instead of TDF if eGFR <50. Monitor creatinine 3-monthly.' },
        { drug: 'cotrimoxazole', eGFRThreshold: 30, concern: 'High-dose cotrimoxazole requires dose reduction in renal impairment.', recommendation: 'Halve dose if eGFR 15–30. Avoid if eGFR <15 (unless no alternative).' },
      ];

      for (const entry of RENAL_ADJUST) {
        if (renalFunction < entry.eGFRThreshold) {
          const key = normalize(entry.drug);
          if (names.some(n => n.includes(key) || key.includes(n))) {
            renal_alerts.push({
              drug: entry.drug,
              eGFR: renalFunction,
              concern: entry.concern,
              recommendation: entry.recommendation,
            });
          }
        }
      }
    }

    const allAlerts = [...high_alert_medications, ...beers_criteria_alerts, ...renal_alerts];

    return {
      has_high_risk_medications: allAlerts.length > 0,
      high_alert_medications,
      beers_criteria_alerts,
      renal_alerts,
      stopp_criteria_alerts: [],
      summary: {
        total_medications: medications.length,
        high_alert_count: high_alert_medications.length,
        beers_count: beers_criteria_alerts.length,
        renal_count: renal_alerts.length,
      },
      warnings: allAlerts.length > 0
        ? ['High-risk medications identified — clinical review required']
        : [],
      source: 'local_fallback',
      cdss_unavailable: true,
    };
  }

  /**
   * Detect care gaps
   */
  async detectCareGaps(
    patientAge?: number,
    patientGender?: string,
    visitHistory?: any[],
    diagnoses?: string[],
    options?: CareGapDetectionOptions,
  ) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'care_gaps_detect',
        '/care-gaps/detect',
        {
        patient_age: patientAge,
        patient_gender: patientGender,
        visit_history: visitHistory || [],
        diagnoses: diagnoses || [],
        context: options?.context || null,
        specialty: options?.specialty || null,
        module: options?.module || null,
        patient_context: {
          age: patientAge ?? null,
          gender: patientGender || null,
          specialty: options?.specialty || null,
          module: options?.module || null,
        },
        },
        15000,
        options?.tenantId,
      );
      await this.recordGovernedPromptAudit({
        tenantDb: options?.tenantDb,
        tenantId: options?.tenantId,
        useCase: 'care_gap_detection',
        source: 'cdss_service',
        model: String(responseData?.model || 'care_gap_detection_proxy'),
        patientId: options?.patientId || null,
        requestBody: {
          patientAge: patientAge ?? null,
          patientGender: patientGender || null,
          visitHistoryCount: Array.isArray(visitHistory) ? visitHistory.length : 0,
          diagnosisCount: Array.isArray(diagnoses) ? diagnoses.length : 0,
          context: options?.context || null,
          specialty: options?.specialty || null,
          module: options?.module || null,
        },
        responseSummary: {
          gapCount: Array.isArray(responseData?.gaps) ? responseData.gaps.length : Array.isArray(responseData) ? responseData.length : 0,
          abstained: responseData?.abstained === true,
        },
        governance: responseData?.governance || {},
      });
      return responseData;
    } catch (error: any) {
      this.logger.warn(`CDSS care gap detection unavailable: ${error.message}`);
      return {
        has_gaps: false, // Default to false but warn
        gaps: [],
        recommendations: [],
        warnings: ['CDSS service unavailable - care gap detection failed'],
        source: 'error'
      };
    }
  }

  async predictDeteriorationRisk(
    payload: {
      patientId: string;
      admissionId?: string;
      vitals?: Record<string, any>;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<any> {
    const responseData = await this.postWithPolicy<any>(
      'risk_deterioration',
      '/risk/deterioration',
      {
        patientId: payload.patientId,
        admissionId: payload.admissionId,
        vitals: payload.vitals || {},
      },
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'risk_deterioration',
      source: 'cdss_service',
      model: String(responseData?.model || 'risk_deterioration_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.admissionId || null,
      requestBody: {
        hasVitals: !!payload.vitals,
        vitalKeys: Object.keys(payload.vitals || {}).sort(),
      },
      responseSummary: {
        score: responseData?.score ?? null,
        eventType: responseData?.event_type || null,
        timeframeHours: responseData?.timeframe_hours ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async predictReadmissionRisk(
    payload: {
      patientId: string;
      dischargeId?: string;
      clinicalData?: Record<string, any>;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<any> {
    const requestBody = {
      patientId: payload.patientId,
      dischargeId: payload.dischargeId,
      ...(payload.clinicalData || {}),
    };
    const responseData = await this.postWithPolicy<any>(
      'risk_readmission',
      '/risk/readmission',
      requestBody,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'risk_readmission',
      source: 'cdss_service',
      model: String(responseData?.model || 'risk_readmission_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.dischargeId || null,
      requestBody: {
        clinicalKeys: Object.keys(payload.clinicalData || {}).sort(),
      },
      responseSummary: {
        risk: responseData?.risk ?? null,
        category: responseData?.category || null,
        followupDays: responseData?.followup_days ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async analyzeRadiologyStudy(
    payload: {
      studyId: string;
      patientId: string;
      modality: string;
      bodyPart?: string;
      storageKey: string;
    },
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<RadiologyAnalysisResponse> {
    const responseData = await this.postWithPolicy<any>(
      'radiology_analyze',
      '/radiology/analyze',
      {
        studyId: payload.studyId,
        patientId: payload.patientId,
        modality: payload.modality,
        bodyPart: payload.bodyPart,
        storageKey: payload.storageKey,
      },
      60000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'radiology_analysis',
      source: 'cdss_service',
      model: String(responseData?.model_version || responseData?.model || 'radiology_analysis_proxy'),
      patientId: payload.patientId || null,
      encounterId: payload.studyId || null,
      requestBody: {
        modality: payload.modality,
        bodyPart: payload.bodyPart || null,
        hasStorageKey: Boolean(payload.storageKey),
      },
      responseSummary: {
        findingCount: Array.isArray(responseData?.findings) ? responseData.findings.length : 0,
        topFinding: responseData?.top_finding || null,
        confidence: responseData?.confidence ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      findings: Array.isArray(responseData?.findings) ? responseData.findings : [],
      top_finding: responseData?.top_finding,
      confidence: responseData?.confidence,
      heatmap_key: responseData?.heatmap_key,
      model_version: responseData?.model_version,
      modality: responseData?.modality,
      governance: responseData?.governance || {},
      abstained: responseData?.abstained === true,
    };
  }

  async checkPgx(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<PgxCheckResponse> {
    const responseData = await this.postWithPolicy<any>(
      'pgx_check',
      '/pgx/check',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'pgx_check',
      source: 'cdss_service',
      model: String(responseData?.model || 'pgx_check_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        drug: payload?.drug || null,
        geneKeys: Object.keys(payload || {})
          .filter((key) => key !== 'patientId' && key !== 'drug')
          .sort(),
      },
      responseSummary: {
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        safe: responseData?.safe !== false,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      drug: String(responseData?.drug || payload?.drug || ''),
      alerts: Array.isArray(responseData?.alerts) ? responseData.alerts : [],
      safe: responseData?.safe !== false,
      governance: responseData?.governance || {},
      abstained: responseData?.abstained === true,
    };
  }

  async optimizeFormulary(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<FormularyOptimizeResponse> {
    const responseData = await this.postWithPolicy<any>(
      'formulary_optimize',
      '/formulary/optimize',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'formulary_optimization',
      source: 'cdss_service',
      model: String(responseData?.model || 'formulary_optimize_proxy'),
      patientId: payload?.patientId || null,
      encounterId: payload?.prescriptionId || null,
      requestBody: {
        brandedDrug: payload?.brandedDrug || null,
        hasMedicalAidScheme: Boolean(payload?.medicalAidScheme),
        diagnosisCount: Array.isArray(payload?.diagnoses) ? payload.diagnoses.length : 0,
      },
      responseSummary: {
        recommendation: responseData?.recommendation || null,
        savingAmount: responseData?.saving_amount ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return {
      recommendation: String(responseData?.recommendation || 'keep_branded'),
      generic_alternative: responseData?.generic_alternative,
      branded_cost: responseData?.branded_cost,
      generic_cost: responseData?.generic_cost,
      saving_amount: responseData?.saving_amount,
      evidence_equivalence: responseData?.evidence_equivalence,
      medical_aid_coverage: responseData?.medical_aid_coverage,
      medical_aid_tier: responseData?.medical_aid_tier,
      reason: responseData?.reason,
      governance: responseData?.governance || {},
      abstained: responseData?.abstained === true,
    };
  }

  async palliativePrognosis(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<Record<string, any>> {
    const responseData = await this.postWithPolicy<any>(
      'palliative_prognosis',
      '/palliative/prognosis',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'palliative_prognosis',
      source: 'cdss_service',
      model: String(responseData?.model || 'palliative_prognosis_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        ecog_ps: payload?.ecog_ps ?? null,
        kps: payload?.kps ?? null,
        primary_diagnosis: payload?.primary_diagnosis || null,
      },
      responseSummary: {
        phase_of_illness: responseData?.phase_of_illness || null,
        survival_estimate: responseData?.survival_estimate || null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async palliativeOpioidConvert(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<Record<string, any>> {
    const responseData = await this.postWithPolicy<any>(
      'palliative_opioid_convert',
      '/palliative/opioid/convert',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'palliative_opioid_convert',
      source: 'cdss_service',
      model: String(responseData?.model || 'palliative_opioid_convert_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        drug: payload?.drug || null,
        target_drug: payload?.target_drug || null,
        route: payload?.route || null,
        target_route: payload?.target_route || null,
      },
      responseSummary: {
        adjusted_dose_mg_24h: responseData?.adjusted_dose_mg_24h ?? null,
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async palliativeSymptomManage(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<Record<string, any>> {
    const responseData = await this.postWithPolicy<any>(
      'palliative_symptom_manage',
      '/palliative/symptom/manage',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'palliative_symptom_manage',
      source: 'cdss_service',
      model: String(responseData?.model || 'palliative_symptom_manage_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        symptom: payload?.symptom || null,
        severity: payload?.severity ?? null,
        oral_route_available: payload?.oral_route_available ?? null,
        is_last_days_of_life: payload?.is_last_days_of_life ?? null,
      },
      responseSummary: {
        suggestionCount: Array.isArray(responseData?.pharmacological_suggestions)
          ? responseData.pharmacological_suggestions.length
          : 0,
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async classifyDermatologyLesion(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<DermatologyDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'dermatology_lesion_classify',
      '/dermatology/lesion/classify',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'dermatology_lesion_classify',
      source: 'cdss_service',
      model: String(responseData?.model || 'dermatology_lesion_classify_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        morphology: payload?.morphology || null,
        location: payload?.location || null,
        diameter_mm: payload?.diameter_mm ?? null,
      },
      responseSummary: {
        urgency: responseData?.urgency || null,
        biopsy_recommended: responseData?.biopsy_recommended ?? null,
        differentialCount: Array.isArray(responseData?.differentials) ? responseData.differentials.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async calculateDermatologyBurnFluid(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<DermatologyDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'dermatology_burn_fluid',
      '/dermatology/burn/fluid',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'dermatology_burn_fluid',
      source: 'cdss_service',
      model: String(responseData?.model || 'dermatology_burn_fluid_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        weight_kg: payload?.weight_kg ?? null,
        tbsa_percent: payload?.tbsa_percent ?? null,
        burn_depth: payload?.burn_depth || null,
        inhalation_injury: payload?.inhalation_injury ?? null,
      },
      responseSummary: {
        parkland_total_ml: responseData?.parkland_total_ml ?? null,
        referralCount: Array.isArray(responseData?.referral_criteria) ? responseData.referral_criteria.length : 0,
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async screenNutritionRisk(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<NutritionDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'nutrition_screen',
      '/nutrition/screen',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'nutrition_screen',
      source: 'cdss_service',
      model: String(responseData?.model || 'nutrition_screen_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        tool: payload?.tool || null,
        age_years: payload?.age_years ?? null,
      },
      responseSummary: {
        risk_category: responseData?.risk_category || null,
        total_score: responseData?.total_score ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async prescribeNutritionPlan(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<NutritionDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'nutrition_prescribe',
      '/nutrition/prescribe',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'nutrition_prescribe',
      source: 'cdss_service',
      model: String(responseData?.model || 'nutrition_prescribe_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        route: payload?.route || null,
        weight_kg: payload?.weight_kg ?? null,
        stress_factor: payload?.stress_factor || null,
      },
      responseSummary: {
        tee_kcal: responseData?.tee_kcal ?? null,
        protein_target_g: responseData?.protein_target_g ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async assessNutritionRefeedingRisk(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<NutritionDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'nutrition_refeeding_risk',
      '/nutrition/refeeding-risk',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'nutrition_refeeding_risk',
      source: 'cdss_service',
      model: String(responseData?.model || 'nutrition_refeeding_risk_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        duration_starvation_days: payload?.duration_starvation_days ?? null,
        bmi: payload?.bmi ?? null,
      },
      responseSummary: {
        risk_level: responseData?.risk_level || null,
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async getNutritionCmamProtocol(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<NutritionDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'nutrition_cmam_protocol',
      '/cdss/nutrition/cmam-protocol',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'nutrition_cmam_protocol',
      source: 'cdss_service',
      model: 'nutrition_cmam_protocol_rules',
      patientId: payload?.patientId || null,
      requestBody: {
        classification: payload?.classification || null,
        oedema_grade: payload?.oedema_grade || null,
        weight_kg: payload?.weight_kg ?? null,
        age_months: payload?.age_months ?? null,
      },
      responseSummary: {
        program: responseData?.program || null,
        rutf_product: responseData?.rutf_product || null,
        rutf_sachets_per_day: responseData?.rutf_sachets_per_day ?? null,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async generatePatientEducation(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<EducationGenerationResponse> {
    const responseData = await this.postWithPolicy<any>(
      'education_generate',
      '/education/generate',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'patient_education_generation',
      source: 'cdss_service',
      model: String(responseData?.model || 'patient_education_generation_proxy'),
      patientId: payload?.patient_id || payload?.patientId || null,
      encounterId: payload?.encounterId || null,
      requestBody: {
        topic: payload?.topic || null,
        language: payload?.language || null,
        reading_level: payload?.reading_level ?? payload?.readingLevel ?? null,
      },
      responseSummary: {
        contentPresent: Boolean(responseData?.content),
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async screenSdohRisk(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<Record<string, any>> {
    const responseData = await this.postWithPolicy<any>(
      'sdoh_screen',
      '/sdoh/screen',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'sdoh_screen',
      source: 'cdss_service',
      model: String(responseData?.model || 'sdoh_screen_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        tool: payload?.tool || payload?.tool_used || null,
        responseKeys: Object.keys(payload?.responses || payload || {}).sort(),
      },
      responseSummary: {
        positiveDomainCount: Array.isArray(responseData?.positive_domains) ? responseData.positive_domains.length : 0,
        overallRisk: responseData?.overall_risk || null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async matchSdohResources(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<Record<string, any>> {
    const responseData = await this.postWithPolicy<any>(
      'sdoh_resource_match',
      '/sdoh/resource/match',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'sdoh_resource_match',
      source: 'cdss_service',
      model: String(responseData?.model || 'sdoh_resource_match_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        requested_categories: payload?.requested_categories || [],
        positiveDomainCount: Array.isArray(payload?.positive_domains) ? payload.positive_domains.length : 0,
        candidateResourceCount: Array.isArray(payload?.available_resources) ? payload.available_resources.length : 0,
      },
      responseSummary: {
        matchCount: Array.isArray(responseData?.matches) ? responseData.matches.length : 0,
        unmetCount: Array.isArray(responseData?.unmet_categories) ? responseData.unmet_categories.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  /**
   * Check drug–food interactions
   */
  async checkFoodInteractions(medications: any[]) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'food_interactions',
        '/medications/food-interactions',
        {
        medications,
        },
        15000,
      );
      return responseData;
    } catch (error: any) {
      this.logger.warn(`CDSS food interaction check unavailable: ${error.message}`);
      return {
        interactions: [],
        summary: { major: 0, moderate: 0 },
        recommendations: ['Food interaction service unavailable'],
        source: 'error'
      };
    }
  }

  private async fetchPatientHistory(patientId: string, tenantDb: DataSource) {
    try {
      const { AppointmentSimple } = await import('../entities/appointment-simple.entity');
      const { Vitals } = await import('../entities/vitals.entity');
      const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
      const vitalsRepo = tenantDb.getRepository(Vitals);
      
      // Fetch all appointments
      const appointments = await appointmentRepo.find({
        where: { patientId },
        order: { appointmentDate: 'DESC' },
        take: 50, // Last 50 visits
      });
      
      // Fetch all vitals
      const vitals = await vitalsRepo.find({
        where: { patientId },
        order: { recordedAt: 'DESC' },
        take: 50, // Last 50 vitals
      });
      
      // Calculate visit statistics
      const completedAppointments = appointments.filter(a => a.status === 'completed');
      const urgentVisits = appointments.filter(a => a.priorityLevel === 'urgent' || a.priorityLevel === 'high');
      
      // Calculate days since last visit
      let daysSinceLastVisit: number | null = null;
      if (appointments.length > 0) {
        const lastVisit = appointments[0].appointmentDate;
        const now = new Date();
        daysSinceLastVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Format historical vitals for trend analysis
      const historicalVitals = vitals.map(v => ({
        bloodPressure: v.bloodPressure,
        heartRate: v.heartRate,
        temperature: v.temperature,
        weight: v.weight,
        oxygenSaturation: v.oxygenSaturation,
        respiratoryRate: v.respiratoryRate,
        bloodGlucose: v.bloodGlucose,
        recordedAt: v.recordedAt?.toISOString() || new Date().toISOString(),
      }));
      
      // Format visit history
      const visitHistory = appointments.map(a => ({
        appointmentDate: a.appointmentDate?.toISOString() || new Date().toISOString(),
        appointmentType: a.appointmentType,
        status: a.status,
        priorityLevel: a.priorityLevel,
        reason: a.reason,
        notes: a.notes,
      }));
      
      return {
        totalVisits: appointments.length,
        completedVisits: completedAppointments.length,
        urgentVisits: urgentVisits.length,
        previousAdmissions: urgentVisits.length, // Simplified - could track actual admissions
        edVisits: urgentVisits.filter(v => v.priorityLevel === 'urgent').length,
        daysSinceLastVisit,
        historicalVitals,
        visitHistory,
        totalVitals: vitals.length,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching patient history: ${error.message}`);
      return {};
    }
  }

  /**
   * Basic risk assessment (fallback) — wires to existing vitals safety logic
   * plus age and diagnosis-based risk stratification.
   */
  private async basicRiskAssessment(patientData: any) {
    const vitals = patientData?.vitals || {};
    const age = Number(patientData?.age) || null;
    const diagnoses: string[] = Array.isArray(patientData?.diagnoses)
      ? patientData.diagnoses
      : typeof patientData?.diagnoses === 'string'
        ? [patientData.diagnoses]
        : [];

    // Leverage the existing vitals safety analysis
    const safetyResult = this.applyVitalsSafetyOverrides(null, vitals);

    // Age-based risk factors
    const ageFactors: Array<{ factor: string; impact: string }> = [];
    if (age !== null) {
      if (age >= 65) ageFactors.push({ factor: 'Age ≥65 — increased vulnerability to adverse outcomes', impact: 'moderate' });
      if (age < 5)  ageFactors.push({ factor: 'Age <5 — high vulnerability, paediatric protocols required', impact: 'moderate' });
    }

    // Diagnosis-based risk elevations
    const diagText = diagnoses.join(' ').toLowerCase();
    const diagFactors: Array<{ factor: string; impact: string }> = [];
    if (/diabetes|diabetic/.test(diagText))           diagFactors.push({ factor: 'Diabetes mellitus — increased infection risk and impaired wound healing', impact: 'moderate' });
    if (/hiv|aids/.test(diagText))                    diagFactors.push({ factor: 'HIV/AIDS — immunosuppression increases infection severity and atypical presentation risk', impact: 'major' });
    if (/\btb\b|tuberculosis/.test(diagText))         diagFactors.push({ factor: 'Active TB — airborne infection control precautions required', impact: 'major' });
    if (/heart.?fail|cardiac|cardiomyopath/.test(diagText)) diagFactors.push({ factor: 'Cardiac disease — haemodynamic monitoring required', impact: 'major' });
    if (/renal|kidney|\bckd\b/.test(diagText))        diagFactors.push({ factor: 'Renal impairment — adjust drug doses; monitor fluid balance', impact: 'moderate' });
    if (/malaria/.test(diagText))                     diagFactors.push({ factor: 'Malaria — monitor for progression to severe disease (cerebral, severe anaemia)', impact: 'moderate' });

    // Elevate risk level if major diagnosis factors present
    let finalLevel = safetyResult.riskLevel;
    if (diagFactors.some(f => f.impact === 'major') && (finalLevel === 'low' || finalLevel === 'unknown')) {
      finalLevel = 'moderate';
    }

    const scoreMap: Record<string, number> = { critical: 0.9, high: 0.7, moderate: 0.4, low: 0.2, unknown: 0.0 };
    return {
      overall_score: scoreMap[finalLevel] ?? 0.0,
      risk_level: finalLevel,
      factors: [...safetyResult.factors, ...ageFactors, ...diagFactors],
      recommendations: safetyResult.recommendations,
      source: 'local_fallback',
      cdss_unavailable: true,
      warning: 'CDSS service unavailable. Risk assessment based on vitals safety rules and known diagnoses only. Full ML-based scoring requires CDSS service.',
    };
  }

  private buildCopilotAuditMetadata(actionType: string, tenantId: string | undefined, promptContext: any, recommendationSummary: string) {
    const contextPayload = JSON.stringify(promptContext ?? {});
    const promptContextHash = createHash('sha256').update(contextPayload).digest('hex');
    return {
      actionType,
      tenantId: tenantId || null,
      modelVersion: process.env.CDSS_MODEL_VERSION || 'cdss-service-v1',
      promptContextHash,
      recommendationSummary,
      timestamp: new Date().toISOString(),
    };
  }

  private mapRiskToTriageLevel(riskLevel: string | undefined): 'resuscitation' | 'emergency' | 'urgent' | 'semi-urgent' | 'non-urgent' {
    const normalized = (riskLevel || '').toLowerCase();
    if (normalized === 'critical' || normalized === 'high') return 'emergency';
    if (normalized === 'moderate') return 'urgent';
    if (normalized === 'low') return 'semi-urgent';
    return 'non-urgent';
  }

  private normalizeVitalsForSafety(vitalsRaw: any) {
    const vitals = vitalsRaw || {};
    const readNumber = (...keys: string[]): number | null => {
      for (const key of keys) {
        if (vitals[key] !== undefined && vitals[key] !== null && vitals[key] !== '') {
          const value = Number(vitals[key]);
          if (Number.isFinite(value)) return value;
        }
      }
      return null;
    };
    let systolic: number | null = null;
    let diastolic: number | null = null;
    if (typeof vitals.bloodPressure === 'string' && vitals.bloodPressure.includes('/')) {
      const [sys, dia] = vitals.bloodPressure.split('/').map((v: string) => parseInt(v.trim(), 10));
      systolic = Number.isFinite(sys) ? sys : null;
      diastolic = Number.isFinite(dia) ? dia : null;
    }
    systolic = readNumber('bloodPressureSystolic', 'systolicBp', 'systolic_bp', 'systolic') ?? systolic;
    diastolic = readNumber('bloodPressureDiastolic', 'diastolicBp', 'diastolic_bp', 'diastolic') ?? diastolic;

    const heartRate = readNumber('heartRate', 'heart_rate');
    const temperature = readNumber('temperature');
    const oxygenSaturation = readNumber('oxygenSaturation', 'oxygen_saturation', 'spo2');
    const respiratoryRate = readNumber('respiratoryRate', 'respiratory_rate');
    const painLevel = readNumber('painLevel', 'pain_level', 'painScore', 'pain_score');
    const rawGlucose = readNumber('bloodGlucose', 'blood_glucose', 'glucose');
    const bloodGlucoseMmol = rawGlucose !== null && rawGlucose > 60 ? Number((rawGlucose / 18).toFixed(1)) : rawGlucose;
    const news2Score = readNumber('news2Score', 'newsScore', 'news2_score', 'news_score');

    return {
      systolic,
      diastolic,
      heartRate,
      temperature,
      oxygenSaturation,
      respiratoryRate,
      painLevel,
      bloodGlucoseMmol,
      news2Score,
    };
  }

  private applyVitalsSafetyOverrides(
    baseRisk: { risk_level?: string; recommendations?: string[]; factors?: any[]; model?: string; overall_score?: number } | null,
    vitalsRaw: any,
  ) {
    const vitals = this.normalizeVitalsForSafety(vitalsRaw);
    const factors: string[] = [];

    const highFever = vitals.temperature !== null && vitals.temperature >= 39;
    const severeFever = vitals.temperature !== null && vitals.temperature >= 40;
    const tachycardia = vitals.heartRate !== null && vitals.heartRate >= 120;
    const severeTachycardia = vitals.heartRate !== null && vitals.heartRate >= 140;
    const tachypnea = vitals.respiratoryRate !== null && vitals.respiratoryRate >= 25;
    const severeTachypnea = vitals.respiratoryRate !== null && vitals.respiratoryRate >= 30;
    const hypotension =
      (vitals.systolic !== null && vitals.systolic < 90) ||
      (vitals.diastolic !== null && vitals.diastolic < 60);
    const hypertensiveCrisis =
      (vitals.systolic !== null && vitals.systolic >= 180) ||
      (vitals.diastolic !== null && vitals.diastolic >= 120);
    const severeDiastolicHypertension = vitals.diastolic !== null && vitals.diastolic >= 110;
    const veryLowSpO2 =
      vitals.oxygenSaturation !== null && vitals.oxygenSaturation > 0 && vitals.oxygenSaturation < 90;
    const severePain = vitals.painLevel !== null && vitals.painLevel >= 8;
    const hyperglycemia = vitals.bloodGlucoseMmol !== null && vitals.bloodGlucoseMmol >= 20;
    const severeHyperglycemia = vitals.bloodGlucoseMmol !== null && vitals.bloodGlucoseMmol >= 25;
    const highNews2 = vitals.news2Score !== null && vitals.news2Score >= 7;
    const mediumNews2 = vitals.news2Score !== null && vitals.news2Score >= 5;

    if (highNews2) {
      factors.push(`NEWS2 ${vitals.news2Score} indicates high acute deterioration risk`);
    } else if (mediumNews2) {
      factors.push(`NEWS2 ${vitals.news2Score} indicates increased acute deterioration risk`);
    }
    if (severeFever) {
      factors.push(`High fever ${vitals.temperature?.toFixed(1)}°C above safety threshold`);
    } else if (highFever) {
      factors.push(`Fever ${vitals.temperature?.toFixed(1)}°C above normal range`);
    }
    if (tachycardia) {
      factors.push(`Tachycardia ${vitals.heartRate} bpm`);
    }
    if (hypotension) {
      const bp = `${vitals.systolic ?? '?'} / ${vitals.diastolic ?? '?'}`;
      factors.push(`Hypotension with blood pressure approximately ${bp}`);
    }
    if (hypertensiveCrisis) {
      const bp = `${vitals.systolic ?? '?'} / ${vitals.diastolic ?? '?'}`;
      factors.push(`Hypertensive crisis range blood pressure ${bp}`);
    } else if (severeDiastolicHypertension) {
      factors.push(`Severe diastolic hypertension ${vitals.diastolic} mmHg`);
    }
    if (tachypnea) {
      factors.push(`Tachypnoea ${vitals.respiratoryRate} breaths/min`);
    }
    if (veryLowSpO2) {
      factors.push(`Low oxygen saturation ${vitals.oxygenSaturation}%`);
    }
    if (severePain) {
      factors.push(`Severe pain ${vitals.painLevel}/10`);
    }
    if (hyperglycemia) {
      factors.push(`Hyperglycaemia ${vitals.bloodGlucoseMmol} mmol/L requiring DKA/HHS screen`);
    }

    let safetyLevel: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    const dangerSignals = [
      highFever,
      tachycardia,
      tachypnea,
      hypotension,
      hypertensiveCrisis,
      veryLowSpO2,
      severePain,
      hyperglycemia,
      mediumNews2,
    ].filter(Boolean).length;

    if (
      dangerSignals >= 3 ||
      highNews2 ||
      veryLowSpO2 ||
      hypertensiveCrisis ||
      severeFever ||
      severeTachycardia ||
      severeTachypnea ||
      severeHyperglycemia ||
      (vitals.systolic !== null && vitals.systolic < 80)
    ) {
      safetyLevel = 'critical';
    } else if (dangerSignals >= 1) {
      safetyLevel = 'high';
    } else if (highFever) {
      safetyLevel = 'moderate';
    }

    const baseLevel = (baseRisk?.risk_level || 'unknown').toLowerCase();
    const order = ['unknown', 'low', 'moderate', 'high', 'critical'];
    const baseIndex = order.indexOf(baseLevel as any);
    const safetyIndex = order.indexOf(safetyLevel as any);
    const finalLevel = safetyIndex > baseIndex ? safetyLevel : (baseLevel as any as 'low' | 'moderate' | 'high' | 'critical' | 'unknown');

    const acuteRecommendations: string[] = [];
    if (finalLevel === 'critical') {
      acuteRecommendations.push(
        'Critical acute deterioration pattern detected: immediate clinical review required.',
        'Escalate to senior clinician or emergency response according to local protocol.',
        'Repeat full vitals within 15 minutes and verify measurement accuracy.',
      );
      if (veryLowSpO2) acuteRecommendations.push('Start oxygen support and assess for respiratory failure.');
      if (hypertensiveCrisis) acuteRecommendations.push('Assess for hypertensive emergency and end-organ damage.');
      if (hyperglycemia) acuteRecommendations.push('Check blood or urine ketones, venous/arterial pH, electrolytes, and hydration status.');
    } else if (finalLevel === 'high') {
      acuteRecommendations.push(
        'High risk vitals pattern: prompt clinical review recommended.',
        'Consider sepsis, dehydration, shock or other acute causes based on local protocol.',
        'Repeat vitals within a short interval and monitor closely.',
      );
    } else if (finalLevel === 'moderate') {
      acuteRecommendations.push(
        'Abnormal vitals detected: clinical review and closer monitoring recommended.',
        'Repeat vitals and assess for underlying infection, pain or distress.',
      );
    } else if (finalLevel === 'low') {
      acuteRecommendations.push(
        'No severe danger signals detected in vitals alone.',
        'Continue routine monitoring and use clinical judgement.',
      );
    }

    const baseRecommendations = Array.isArray(baseRisk?.recommendations) ? baseRisk!.recommendations : [];
    const filteredBaseRecommendations = baseRecommendations.filter((rec) => {
      const lower = String(rec).toLowerCase();
      if (lower.includes('readmission')) return false;
      if (lower.includes('discharge')) return false;
      if (lower.includes('follow-up')) return false;
      if (lower.includes('routine')) return false;
      return true;
    });
    const suppressedRecommendations = baseRecommendations.filter((rec) => !filteredBaseRecommendations.includes(rec));

    const combinedFactors = [
      ...(Array.isArray(baseRisk?.factors) ? baseRisk!.factors : []),
      ...factors.map((f) => ({ factor: f, impact: 'major' })),
    ];

    return {
      riskLevel: finalLevel,
      recommendations: [...acuteRecommendations, ...filteredBaseRecommendations],
      factors: combinedFactors,
      safetyOverride: safetyLevel !== 'low',
      safetyLevel,
      suppressedRecommendations,
      conflictDetected:
        safetyLevel !== 'low' &&
        ['unknown', 'low'].includes((baseRisk?.risk_level || 'unknown').toLowerCase()) &&
        suppressedRecommendations.length > 0,
    };
  }

  async analyzeNurseTriage(payload: any, tenantDb?: DataSource, tenantId?: string) {
    const triageInput = payload || {};
    const symptoms = Array.isArray(triageInput.symptoms)
      ? triageInput.symptoms
      : [triageInput.chiefComplaint || triageInput.reason || 'general assessment'].filter(Boolean);

    const diagnosis = await this.diagnosisAssist(
      {
        symptoms,
        chiefComplaint: triageInput.chiefComplaint,
        historyOfPresentIllness: triageInput.historyOfPresentIllness,
        clinicalNotes: triageInput.clinicalNotes,
        vitals: triageInput.vitals,
        age: triageInput.age,
        gender: triageInput.gender,
        labs: triageInput.labs,
        conditions: triageInput.conditions || triageInput.diagnoses || [],
        context: triageInput.context || 'emergency_triage',
        specialty: triageInput.specialty || 'acute_care',
        module: triageInput.module || 'emergency_triage',
      },
      true,
      tenantId,
      tenantDb,
    );

    let risk: any = null;
    try {
      if (triageInput.vitals || triageInput.patientId) {
        risk = await this.riskAssessment(
          {
            patientId: triageInput.patientId,
            age: triageInput.age,
            gender: triageInput.gender,
            vitals: triageInput.vitals || {},
            diagnoses: triageInput.conditions || triageInput.diagnoses || [],
            medications: triageInput.medications || [],
            medicalHistory: triageInput.medicalHistory || [],
            labResults: triageInput.labs,
            context: triageInput.context || 'emergency_triage',
            specialty: triageInput.specialty || 'acute_care',
            module: triageInput.module || 'emergency_triage',
          },
          tenantDb,
          tenantId,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Nurse triage risk assessment unavailable: ${error.message}`);
    }

    const riskLevel = risk?.risk_level || diagnosis?.urgencyLevel || 'unknown';
    const suggestedTriageLevel = this.mapRiskToTriageLevel(riskLevel);
    const reasons: string[] = [
      ...(Array.isArray(diagnosis?.red_flags) ? diagnosis.red_flags : []),
      ...(Array.isArray(risk?.factors) ? risk.factors.map((f: any) => String(f?.name || f?.factor || f)) : []),
    ].slice(0, 8);

    const missingData: string[] = [];
    if (!triageInput.vitals) missingData.push('vitals');
    if (!triageInput.chiefComplaint) missingData.push('chiefComplaint');
    if (!triageInput.age) missingData.push('age');
    if (!triageInput.gender) missingData.push('gender');

    const recommendationSummary = `Suggested triage level ${suggestedTriageLevel} with risk ${riskLevel}`;
    this.metricsService?.recordNurseCopilotRecommendation('triage', String(riskLevel || 'unknown'));
    const triageElapsedSeconds =
      this.secondsSince(triageInput?.queueEnteredAt) ??
      this.secondsSince(triageInput?.queue_created_at) ??
      this.secondsSince(triageInput?.arrivedAt);
    if (triageElapsedSeconds !== null) {
      this.metricsService?.recordNurseCopilotTimeToTriage(triageElapsedSeconds);
    }

    return {
      riskLevel,
      suggestedTriageLevel,
      reasons,
      missingData,
      diagnosis,
      risk,
      source: 'ehr_cdss_proxy',
      audit: this.buildCopilotAuditMetadata('triage', tenantId, triageInput, recommendationSummary),
    };
  }

  async interpretNurseVitals(payload: any, tenantDb?: DataSource, tenantId?: string) {
    const vitalsInput = payload || {};
    const risk = await this.riskAssessment(
      {
        patientId: vitalsInput.patientId,
        age: vitalsInput.age,
        gender: vitalsInput.gender,
        vitals: vitalsInput.vitals || vitalsInput,
        diagnoses: vitalsInput.conditions || vitalsInput.diagnoses || [],
        medications: vitalsInput.medications || [],
        medicalHistory: vitalsInput.medicalHistory || [],
        labResults: vitalsInput.labs,
      },
      tenantDb,
      tenantId,
    );

    const safetyAdjusted = this.applyVitalsSafetyOverrides(risk, vitalsInput.vitals || vitalsInput);

    const interpretation = {
      riskLevel: safetyAdjusted.riskLevel || risk?.risk_level || 'unknown',
      overallScore: risk?.overall_score ?? null,
      factors: safetyAdjusted.factors,
      recommendations: safetyAdjusted.recommendations,
      trendSignals: risk?.trends || null,
      visitPatterns: risk?.visit_patterns || null,
      guidance: 'AI suggestion only. Nurse confirmation is required before clinical action.',
    };

    const recommendationSummary = `Vitals interpreted with risk ${interpretation.riskLevel}`;
    this.metricsService?.recordNurseCopilotRecommendation('vitals', String(interpretation.riskLevel || 'unknown'));
    return {
      ...interpretation,
      source: 'ehr_cdss_proxy',
      audit: this.buildCopilotAuditMetadata('vitals', tenantId, vitalsInput, recommendationSummary),
    };
  }

  async generateNurseNoteDraft(payload: any, tenantId?: string, tenantDb?: DataSource) {
    const noteInput = payload || {};
    const noteFragments: string[] = [];
    if (noteInput.chiefComplaint) noteFragments.push(`Chief complaint: ${noteInput.chiefComplaint}`);
    if (noteInput.observations) noteFragments.push(`Observations: ${noteInput.observations}`);
    if (noteInput.interventions) noteFragments.push(`Interventions: ${noteInput.interventions}`);
    if (noteInput.outcomes) noteFragments.push(`Outcomes: ${noteInput.outcomes}`);
    if (Array.isArray(noteInput.previousNotes)) {
      for (const n of noteInput.previousNotes.slice(0, 10)) {
        if (typeof n === 'string' && n.trim()) {
          noteFragments.push(n.trim());
        } else if (n?.content) {
          noteFragments.push(String(n.content));
        }
      }
    }
    if (noteFragments.length === 0) {
      noteFragments.push('Nursing assessment performed. Populate structured fields before finalizing.');
    }

    try {
      const responseData = await this.postWithPolicy<any>(
        'notes_draft',
        '/patient/summarize',
        {
          clinical_notes: noteFragments,
          age: Number(noteInput.age || 0),
          gender: String(noteInput.gender || 'unknown'),
          recent_vitals: noteInput.vitals || {},
        },
        15000,
        tenantId,
      );
      await this.recordGovernedPromptAudit({
        tenantDb,
        tenantId,
        useCase: 'cdss_patient_summarize',
        source: 'cdss_service',
        model: String(responseData?.model || 'patient_summarization_proxy'),
        patientId: noteInput?.patientId || null,
        encounterId: noteInput?.encounterId || null,
        requestBody: {
          noteFragmentCount: noteFragments.length,
          hasVitalsContext: !!noteInput.vitals,
          age: noteInput.age || null,
          gender: noteInput.gender || null,
        },
        responseSummary: {
          draftPresent: Boolean(responseData?.summary || responseData?.one_liner || responseData?.text),
          abstained: responseData?.abstained === true,
        },
        governance: responseData?.governance || {},
      });

      const draftText = responseData?.summary || responseData?.one_liner || responseData?.text || '';
      const recommendationSummary = draftText ? 'Generated nursing note draft' : 'No draft generated';
      this.metricsService?.recordNurseCopilotRecommendation('notes', 'n/a');
      const docElapsedSeconds =
        this.secondsSince(noteInput?.documentationStartedAt) ??
        this.secondsSince(noteInput?.startedAt) ??
        this.secondsSince(noteInput?.started_at);
      if (docElapsedSeconds !== null) {
        this.metricsService?.recordNurseCopilotDocumentationDuration(docElapsedSeconds, 'note');
      }
      return {
        draft: draftText,
        provenance: {
          notesUsed: noteFragments.length,
          hasVitalsContext: !!noteInput.vitals,
          source: 'patient/summarize',
        },
        source: 'ehr_cdss_proxy',
        audit: this.buildCopilotAuditMetadata('notes', tenantId, noteInput, recommendationSummary),
      };
    } catch (error: any) {
      this.logger.warn(`Nurse note draft generation unavailable: ${error.message}`);
      return {
        draft: '',
        provenance: {
          notesUsed: noteFragments.length,
          hasVitalsContext: !!noteInput.vitals,
          source: 'fallback_empty',
        },
        warnings: ['CDSS service unavailable - nursing draft not generated'],
        source: 'error',
        audit: this.buildCopilotAuditMetadata('notes', tenantId, noteInput, 'Draft unavailable'),
      };
    }
  }

  async generateNurseHandoffSummary(payload: any, tenantId?: string, tenantDb?: DataSource) {
    const handoffInput = payload || {};
    const summaryNotes: string[] = [];

    const pushSection = (title: string, value: any) => {
      if (!value) return;
      if (typeof value === 'string') {
        if (value.trim()) summaryNotes.push(`${title}: ${value.trim()}`);
        return;
      }
      if (Array.isArray(value)) {
        if (value.length > 0) summaryNotes.push(`${title}: ${value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' | ')}`);
        return;
      }
      summaryNotes.push(`${title}: ${JSON.stringify(value)}`);
    };

    pushSection('Shift notes', handoffInput.shiftNotes);
    pushSection('Pending tasks', handoffInput.pendingTasks);
    pushSection('Safety alerts', handoffInput.alerts);
    pushSection('Recent nursing notes', handoffInput.nursingNotes);
    pushSection('Recent vitals', handoffInput.vitals);

    if (summaryNotes.length === 0) {
      summaryNotes.push('No major events captured during shift.');
    }

    try {
      const responseData = await this.postWithPolicy<any>(
        'handoff_summary',
        '/patient/summarize',
        {
          clinical_notes: summaryNotes,
          age: Number(handoffInput.age || 0),
          gender: String(handoffInput.gender || 'unknown'),
          recent_vitals: handoffInput.vitals || {},
        },
        15000,
        tenantId,
      );
      await this.recordGovernedPromptAudit({
        tenantDb,
        tenantId,
        useCase: 'cdss_patient_summarize',
        source: 'cdss_service',
        model: String(responseData?.model || 'patient_summarization_proxy'),
        patientId: handoffInput?.patientId || null,
        encounterId: handoffInput?.encounterId || null,
        requestBody: {
          summarySectionCount: summaryNotes.length,
          hasVitalsContext: !!handoffInput.vitals,
          age: handoffInput.age || null,
          gender: handoffInput.gender || null,
        },
        responseSummary: {
          summaryPresent: Boolean(responseData?.summary || responseData?.one_liner || responseData?.text),
          abstained: responseData?.abstained === true,
        },
        governance: responseData?.governance || {},
      });

      const summary = responseData?.summary || responseData?.one_liner || responseData?.text || '';
      const recommendationSummary = summary ? 'Generated nurse handoff summary' : 'No handoff summary generated';
      this.metricsService?.recordNurseCopilotRecommendation('handoff', 'n/a');
      const handoffElapsedSeconds =
        this.secondsSince(handoffInput?.handoffStartedAt) ??
        this.secondsSince(handoffInput?.startedAt) ??
        this.secondsSince(handoffInput?.started_at);
      if (handoffElapsedSeconds !== null) {
        this.metricsService?.recordNurseCopilotDocumentationDuration(handoffElapsedSeconds, 'handoff');
      }
      return {
        summary,
        source: 'ehr_cdss_proxy',
        audit: this.buildCopilotAuditMetadata('handoff', tenantId, handoffInput, recommendationSummary),
      };
    } catch (error: any) {
      this.logger.warn(`Nurse handoff summary generation unavailable: ${error.message}`);
      return {
        summary: '',
        warnings: ['CDSS service unavailable - handoff summary not generated'],
        source: 'error',
        audit: this.buildCopilotAuditMetadata('handoff', tenantId, handoffInput, 'Handoff summary unavailable'),
      };
    }
  }

  async recordCopilotAction(payload: any, tenantId?: string) {
    const decision = String(payload?.decision || payload?.userAction || 'unknown').toLowerCase();
    const copilotType = String(payload?.copilotType || payload?.actionType || 'unknown').toLowerCase();
    const reason = payload?.reason ? String(payload.reason) : null;
    const patientId = payload?.patientId ? String(payload.patientId) : null;
    const recommendationSummary =
      payload?.recommendationSummary
        ? String(payload.recommendationSummary)
        : `copilot ${copilotType} decision ${decision}`;

    this.metricsService?.recordNurseCopilotDecision(copilotType, decision);
    const alertResponseSeconds =
      this.secondsSince(payload?.alertCreatedAt) ??
      this.secondsSince(payload?.alert_created_at) ??
      this.secondsSince(payload?.triggeredAt);
    if (alertResponseSeconds !== null) {
      this.metricsService?.recordNurseCopilotAlertResponseTime(alertResponseSeconds);
    }

    return {
      ok: true,
      copilotType,
      decision,
      reason,
      patientId,
      source: 'ehr_cdss_proxy',
      audit: this.buildCopilotAuditMetadata(
        `copilot_${copilotType}_decision`,
        tenantId,
        payload,
        recommendationSummary,
      ),
    };
  }

  async allergyCheck(patientId: string, medication: string, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ where: { id: patientId } });
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    const allergies = patient.allergies?.toLowerCase() || '';
    const medicationLower = medication.toLowerCase();
    
    const hasAllergy = allergies.includes(medicationLower) || 
                     allergies.includes('penicillin') && medicationLower.includes('penicillin') ||
                     allergies.includes('sulfa') && medicationLower.includes('sulfa');

    return {
      hasAllergy,
      medication,
      patientAllergies: patient.allergies,
      recommendation: hasAllergy ? 
        'CONTRAINDICATED - Patient has known allergy' : 
        'Safe to prescribe - No known allergies'
    };
  }

  async getAllergyWarnings(
    patientId: string,
    medications: string[],
    tenantDb: DataSource,
  ): Promise<{ warnings: AllergyWarning[]; structuredAllergies: any[] }> {
    const structuredRows = await tenantDb.query(
      `SELECT id, allergen, severity, reaction, allergy_type, status
       FROM allergies WHERE patient_id = $1 AND status != 'inactive'`,
      [patientId],
    );

    const patientRepo = tenantDb.getRepository(Patient);
    const patient = await patientRepo.findOne({ where: { id: patientId } });
    const legacyText = patient?.allergies?.toLowerCase() || '';

    const allAllergens: string[] = structuredRows.map((r: any) => (r.allergen || '').toLowerCase());
    if (legacyText) {
      for (const chunk of legacyText.split(/[,;\/]+/)) {
        const trimmed = chunk.trim();
        if (trimmed && !allAllergens.includes(trimmed)) allAllergens.push(trimmed);
      }
    }

    const warnings: AllergyWarning[] = [];

    for (const medName of medications) {
      const medLower = medName.toLowerCase();
      const medClass = this.identifyDrugClass(medLower);

      for (const allergen of allAllergens) {
        if (this.isExactOrFuzzyMatch(medLower, allergen)) {
          const row = structuredRows.find((r: any) => (r.allergen || '').toLowerCase() === allergen);
          warnings.push({
            severity: row?.severity === 'severe' ? 'high' : 'high',
            allergen,
            medication: medName,
            crossReactivity: false,
            message: `Direct allergy match: patient is allergic to "${allergen}".${row?.reaction ? ` Known reaction: ${row.reaction}` : ''}`,
          });
          continue;
        }

        const allergenClass = this.identifyDrugClass(allergen);
        const crossEntry = this.findCrossReactivity(allergen, allergenClass, medLower, medClass);
        if (crossEntry) {
          warnings.push({
            severity: crossEntry.riskLevel,
            allergen,
            medication: medName,
            crossReactivity: true,
            message: crossEntry.message,
          });
        }
      }
    }

    return { warnings, structuredAllergies: structuredRows };
  }

  private identifyDrugClass(drugName: string): string | null {
    for (const [className, members] of Object.entries(DRUG_CLASS_MEMBERS)) {
      if (members.some(m => drugName.includes(m) || m.includes(drugName))) return className;
    }
    return null;
  }

  private isExactOrFuzzyMatch(med: string, allergen: string): boolean {
    if (med === allergen) return true;
    if (med.includes(allergen) || allergen.includes(med)) return true;
    return false;
  }

  private findCrossReactivity(
    allergen: string,
    allergenClass: string | null,
    medication: string,
    medClass: string | null,
  ): CrossReactivityEntry | null {
    const keysToCheck: string[] = [];
    if (allergenClass) keysToCheck.push(allergenClass);
    keysToCheck.push(allergen);

    for (const key of keysToCheck) {
      const entry = CROSS_REACTIVITY_MAP[key];
      if (!entry) continue;

      if (medClass && entry.relatedClasses.includes(medClass)) return entry;
      if (entry.relatedClasses.some(rc => medication.includes(rc) || rc.includes(medication))) return entry;
    }

    if (medClass) {
      const medEntry = CROSS_REACTIVITY_MAP[medClass];
      if (medEntry) {
        if (allergenClass && medEntry.relatedClasses.includes(allergenClass)) return medEntry;
        if (medEntry.relatedClasses.some(rc => allergen.includes(rc) || rc.includes(allergen))) return medEntry;
      }
    }

    return null;
  }

  /**
   * Get dosing recommendations from Python CDSS service
   */
  async getDosingRecommendation(dosingRequest: any) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'dosing_recommendation',
        '/dosing/recommend',
        {
        drug_name: dosingRequest.drug_name,
        patient_age: dosingRequest.patient_age,
        patient_weight_kg: dosingRequest.patient_weight_kg,
        patient_gender: dosingRequest.patient_gender,
        eGFR: dosingRequest.eGFR,
        serum_creatinine: dosingRequest.serum_creatinine,
        crCl: dosingRequest.crCl,
        hepatic_function: dosingRequest.hepatic_function,
        standard_dose: dosingRequest.standard_dose,
        },
        10000,
      );

      return {
        ...responseData,
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS dosing recommendation unavailable: ${error.message}`);
      return {
        recommended_dose: null, // Do not provide a fallback dose
        frequency: 'unknown',
        adjustments: [],
        warnings: ['CDSS service unavailable - Cannot provide dosing recommendation'],
        monitoring: [],
        drug_name: dosingRequest.drug_name,
        source: 'error',
      };
    }
  }

  async extractClinicalCodes(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<AutoCodingExtractionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'clinical_code_extraction',
      '/nlp/extract-codes',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'clinical_code_extraction',
      source: 'cdss_service',
      model: String(responseData?.model || 'clinical_code_extraction_proxy'),
      patientId: payload?.patientId || null,
      encounterId: payload?.encounterId || null,
      requestBody: {
        noteId: payload?.noteId || null,
        noteLength: typeof payload?.noteText === 'string' ? payload.noteText.length : 0,
      },
      responseSummary: {
        icdCount: Array.isArray(responseData?.suggestedIcd10Codes) ? responseData.suggestedIcd10Codes.length : 0,
        cptCount: Array.isArray(responseData?.suggestedCptCodes) ? responseData.suggestedCptCodes.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async analyzeIotReadings(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<IotAnalysisResponse> {
    const responseData = await this.postWithPolicy<any>(
      'iot_analysis',
      '/iot/analyze',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'iot_analysis',
      source: 'cdss_service',
      model: String(responseData?.model || 'iot_analysis_proxy'),
      patientId: payload?.patientId || null,
      requestBody: {
        readingCount: Array.isArray(payload?.readings) ? payload.readings.length : 0,
        readingTypes: Array.isArray(payload?.readings)
          ? Array.from(new Set(payload.readings.map((reading: Record<string, any>) => String(reading?.type || '')).filter(Boolean))).sort()
          : [],
      },
      responseSummary: {
        alertCount: Array.isArray(responseData?.alerts) ? responseData.alerts.length : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async predictSchedulingRisk(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<SchedulingPredictionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'scheduling_prediction',
      '/scheduling/predict',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'scheduling_prediction',
      source: 'cdss_service',
      model: String(responseData?.model || 'scheduling_prediction_proxy'),
      requestBody: {
        appointmentId: payload?.appointmentId || null,
        visitType: payload?.visitType || payload?.visit_type || null,
      },
      responseSummary: {
        noShowProbability: responseData?.no_show_probability ?? null,
        cancelProbability: responseData?.cancel_probability ?? null,
        recommendedDuration: responseData?.recommended_duration ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async suggestFormDefaults(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<SmartDefaultsSuggestionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'smart_form_defaults',
      '/forms/suggest-defaults',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'smart_form_defaults',
      source: 'cdss_service',
      model: String(responseData?.model || 'smart_form_defaults_proxy'),
      requestBody: {
        formName: payload?.formName || payload?.form_name || null,
        contextKeys: Object.keys(payload?.context || payload || {}).sort(),
      },
      responseSummary: {
        defaultCount: responseData?.defaults && typeof responseData.defaults === 'object'
          ? Object.keys(responseData.defaults).length
          : 0,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async recommendEmpiricalAntimicrobial(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<AntimicrobialDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'antimicrobial_empirical',
      '/antimicrobial/empirical',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'antimicrobial_empirical',
      source: 'cdss_service',
      model: String(responseData?.model || 'antimicrobial_empirical_proxy'),
      patientId: payload?.patientId || null,
      encounterId: payload?.encounterId || null,
      requestBody: {
        syndrome: payload?.syndrome || payload?.infectionSyndrome || payload?.infection_site || null,
        severity: payload?.severity || null,
      },
      responseSummary: {
        recommendation: responseData?.recommendation || null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async recommendAntimicrobialDeescalation(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<AntimicrobialDecisionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'antimicrobial_deescalation',
      '/antimicrobial/deescalate',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'antimicrobial_deescalation',
      source: 'cdss_service',
      model: String(responseData?.model || 'antimicrobial_deescalation_proxy'),
      patientId: payload?.patientId || null,
      encounterId: payload?.encounterId || null,
      requestBody: {
        organism: payload?.organism || payload?.organism_isolated || null,
        currentRegimen: payload?.current_regimen || payload?.currentRegimen || null,
      },
      responseSummary: {
        recommendation: responseData?.recommendation || null,
        action: responseData?.action || null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async predictSupplyStockout(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<SupplyChainPredictionResponse> {
    const responseData = await this.postWithPolicy<any>(
      'supply_stockout_prediction',
      '/supply/stockout-predict',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'supply_stockout_prediction',
      source: 'cdss_service',
      model: String(responseData?.model || 'supply_stockout_prediction_proxy'),
      requestBody: {
        drugName: payload?.drugName || null,
        currentStock: payload?.currentStock ?? null,
        avgDailyConsumption: payload?.avgDailyConsumption ?? null,
      },
      responseSummary: {
        seasonalFactor: responseData?.seasonal_factor ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async evaluateModelPerformance(
    payload: Record<string, any>,
    tenantId?: string,
    tenantDb?: DataSource,
  ): Promise<ModelPerformanceResponse> {
    const responseData = await this.postWithPolicy<any>(
      'model_performance',
      '/model/performance',
      payload,
      15000,
      tenantId,
    );

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'model_performance',
      source: 'cdss_service',
      model: String(responseData?.model || 'model_performance_proxy'),
      requestBody: {
        modelName: payload?.modelName || null,
        period: payload?.period || null,
        sampleCount: Array.isArray(payload?.outcomes) ? payload.outcomes.length : 0,
      },
      responseSummary: {
        auc: responseData?.auc_roc ?? null,
        brier: responseData?.brier_score ?? null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async predictClaimDenial(payload: Record<string, any>, tenantId?: string, tenantDb?: DataSource): Promise<{
    risk_score: number;
    confidence: number;
    threshold_action: 'allow' | 'warn' | 'block';
    top_reasons: Array<{ code: string; description: string; weight: number }>;
    model_version: string;
    feature_snapshot: Record<string, any>;
  }> {
    const responseData = await this.postWithPolicy<any>('denial_prediction', '/cdss/claims/denial-prediction', { payload }, 15000, tenantId);

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'claims_denial_prediction',
      source: 'cdss_service',
      model: String(responseData?.model_version || responseData?.model || 'claims_denial_prediction_proxy'),
      patientId: payload?.patient_id || payload?.patientId || null,
      encounterId: payload?.encounter_id || payload?.encounterId || payload?.claim_id || payload?.claimId || null,
      requestBody: {
        procedureCodeCount: Array.isArray(payload?.procedure_codes) ? payload.procedure_codes.length : 0,
        diagnosisCodeCount: Array.isArray(payload?.diagnosis_codes) ? payload.diagnosis_codes.length : 0,
        totalAmount: payload?.total_amount ?? null,
        planType: payload?.plan_type || null,
      },
      responseSummary: {
        riskScore: responseData?.risk_score ?? null,
        action: responseData?.threshold_action || null,
        abstained: responseData?.abstained === true,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async generateAppealTemplateCdss(payload: Record<string, any>, tenantId?: string, tenantDb?: DataSource): Promise<{
    draft_letter: string;
    denial_reason_code: string;
    rag_sources: Array<{ documentId: string; title: string; excerpt: string; relevanceScore: number }>;
    model_version: string;
  }> {
    const responseData = await this.postWithPolicy<any>('appeal_template', '/cdss/claims/appeal-template', { payload }, 20000, tenantId);

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'claims_appeal_generation',
      source: 'cdss_service',
      model: String(responseData?.model_version || responseData?.model || 'claims_appeal_generation_proxy'),
      patientId: payload?.patient_id || payload?.patientId || null,
      encounterId: payload?.claim_id || payload?.claimId || null,
      requestBody: {
        denialReasonCode: payload?.denial_reason_code || null,
        detailKeyCount: Object.keys(payload || {}).length,
      },
      responseSummary: {
        ragSourceCount: Array.isArray(responseData?.rag_sources) ? responseData.rag_sources.length : 0,
        denialReasonCode: responseData?.denial_reason_code || null,
        letterLength: String(responseData?.draft_letter || '').length,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async checkPdmpDrug(payload: {
    drug_name: string;
    dea_schedule: string | null;
    daily_dose_mg: number;
    other_active_controlled_prescriptions: any[];
    prior_substance_abuse_flags: any[];
  }, tenantId?: string, tenantDb?: DataSource): Promise<{
    risk_level: string;
    risk_score: number;
    morphine_milligram_equivalent: number | null;
    dispensing_blocked: boolean;
    prescriber_alerts: any[];
    other_active_prescriptions: any[];
    cdss_recommendation: string;
  }> {
    const responseData = await this.postWithPolicy<any>('pdmp_check', '/cdss/pharmacy/pdmp-check', { payload }, 10000, tenantId);

    await this.recordGovernedPromptAudit({
      tenantDb,
      tenantId,
      useCase: 'pharmacy_pdmp_check',
      source: 'cdss_service',
      model: String(responseData?.model_version || responseData?.model || 'pharmacy_pdmp_check_proxy'),
      requestBody: {
        drugName: payload.drug_name,
        deaSchedule: payload.dea_schedule,
        dailyDoseMg: payload.daily_dose_mg,
        activeControlledCount: Array.isArray(payload.other_active_controlled_prescriptions)
          ? payload.other_active_controlled_prescriptions.length
          : 0,
      },
      responseSummary: {
        riskLevel: responseData?.risk_level || null,
        riskScore: responseData?.risk_score ?? null,
        dispensingBlocked: responseData?.dispensing_blocked === true,
        alertCount: Array.isArray(responseData?.prescriber_alerts) ? responseData.prescriber_alerts.length : 0,
      },
      governance: responseData?.governance || {},
    });

    return responseData;
  }

  async stratifyPatientRisk(payload: Record<string, unknown>, tenantId?: string): Promise<{
    tier: string;
    composite_score: number;
    chronic_condition_score: number;
    vitals_trend_score: number;
    adherence_score: number;
    sdoh_score: number;
    no_show_rate: number;
    lab_trend_score: number;
    contributing_factors: Array<{ factor: string; weight: number; value: string }>;
    recommended_actions: Array<{ action: string; priority: number; dueWithinDays: number }>;
    model_version: string;
  }> {
    return this.postWithPolicy<any>('risk_stratification', '/cdss/risk/stratify', { payload }, 15000, tenantId);
  }

  async ocrInsuranceCard(
    imageBase64: string,
    tenantId?: string,
  ): Promise<{
    member_id: string | null;
    group_number: string | null;
    plan_name: string | null;
    payer_name: string | null;
    effective_date: string | null;
    expiry_date: string | null;
    confidence: number;
    raw_ocr_text: string;
  }> {
    return this.postWithPolicy<any>(
      'insurance_ocr',
      '/cdss/registration/ocr-insurance-card',
      { image_base64: imageBase64 },
      30000,
      tenantId,
    );
  }

  async getSdohQuestions(tenantId?: string): Promise<{ questions: unknown[] }> {
    return this.postWithPolicy<any>(
      'sdoh_questions',
      '/cdss/registration/sdoh-questions',
      {},
      10000,
      tenantId,
    );
  }

  async scoreSdoh(
    payload: { patient_id?: string; answers: Record<string, number> },
    tenantId?: string,
  ): Promise<{
    risk_factors: string[];
    overall_risk_level: string;
    total_risk_domains: number;
    domain_scores: Record<string, unknown>;
    referrals: unknown[];
    model_version: string;
  }> {
    return this.postWithPolicy<any>(
      'sdoh_risk_score',
      '/cdss/registration/sdoh-score',
      payload,
      15000,
      tenantId,
    );
  }

  async generateAttentionMap(
    payload: {
      imaging_order_id: string;
      draft_report_text: string;
      findings: unknown[];
      image_width?: number;
      image_height?: number;
    },
    tenantId?: string,
  ): Promise<{
    heatmap_regions: Array<{
      x: number; y: number; width: number; height: number;
      confidence: number; finding_label: string; finding_type: string; color: string;
    }>;
    model_version: string;
  }> {
    return this.postWithPolicy<any>(
      'radiology_attention_map',
      '/cdss/imaging/attention-map',
      { payload },
      15000,
      tenantId,
    );
  }

  // ── Sprint 119: Clinical Order Intelligence ─────────────────────────────
  async suggestOrderSets(payload: {
    diagnoses?: string[];
    active_medications?: string[];
    chief_complaint?: string;
    vitals_flags?: string[];
    patient_age?: number;
    encounter_type?: string;
  }, tenantId?: string): Promise<any> {
    try {
      return await this.postWithPolicy<any>('order_intelligence', '/order/suggest-sets', payload, 6000, tenantId);
    } catch { return { suggestions: [], abstained: true, abstain_reason: 'safety_gate_triggered' }; }
  }

  async checkImagingAppropriateness(payload: {
    modality: string;
    study_type: string;
    clinical_indication: string;
    diagnoses?: string[];
    patient_age?: number;
    prior_imaging?: string[];
  }, tenantId?: string): Promise<any> {
    try {
      return await this.postWithPolicy<any>('order_intelligence', '/order/imaging-appropriateness', payload, 5000, tenantId);
    } catch { return { appropriateness_status: 'needs_context', blocking_issues: [], abstained: true }; }
  }

  async predictPriorAuth(payload: {
    order_type: string;
    order_name: string;
    cpt_code?: string;
    icd10_codes?: string[];
    payer_name?: string;
    patient_age?: number;
  }, tenantId?: string): Promise<any> {
    try {
      return await this.postWithPolicy<any>('order_intelligence', '/order/prior-auth-predict', payload, 4000, tenantId);
    } catch { return { requires_prior_auth: false, likelihood: 0, abstained: true }; }
  }

  async checkLabReorder(payload: {
    test_codes: string[];
    test_names: string[];
    recent_labs: any[];
    lookback_days?: number;
  }, tenantId?: string): Promise<any> {
    try {
      return await this.postWithPolicy<any>('order_intelligence', '/lab/reorder-check', payload, 4000, tenantId);
    } catch { return { flags: [], abstained: true }; }
  }

  // ── Sprint 120: Nursing Intelligence Suite ────────────────────────────
  async generateNursingCarePlan(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('nursing_intelligence', '/nursing/care-plan', payload, 6000, tenantId); }
    catch { return { care_plan: [], abstained: true, abstain_reason: 'safety_gate_triggered' }; }
  }

  async generateSBAR(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('nursing_intelligence', '/nursing/sbar', payload, 5000, tenantId); }
    catch { return { sbar: {}, abstained: true, abstain_reason: 'safety_gate_triggered' }; }
  }

  async assessFallRisk(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('nursing_intelligence', '/nursing/fall-risk', payload, 4000, tenantId); }
    catch { return { total_score: 0, risk_level: 'unknown', abstained: true }; }
  }

  async stageWound(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('nursing_intelligence', '/nursing/wound-staging', payload, 5000, tenantId); }
    catch { return { stage: null, care_recommendations: [], abstained: true }; }
  }

  // ── Sprint 121: Medication Reconciliation AI ──────────────────────────
  async reconcileMedications(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('medication_reconciliation', '/medication/reconciliation', payload, 6000, tenantId); }
    catch { return { discrepancies: [], abstained: true, abstain_reason: 'safety_gate_triggered' }; }
  }

  async checkPDMP(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('medication_reconciliation', '/medication/pdmp-check', payload, 4000, tenantId); }
    catch { return { detected_controlled: [], pdmp_query_required: false, abstained: true }; }
  }

  // ── Sprint 122: Discharge Intelligence ───────────────────────────────
  async getDischargeIntelligence(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('discharge_intelligence', '/discharge/intelligence', payload, 7000, tenantId); }
    catch { return { readmission_risk: 'unknown', discharge_summary: {}, abstained: true }; }
  }

  async getFollowUpTiming(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('discharge_intelligence', '/discharge/follow-up-timing', payload, 5000, tenantId); }
    catch { return { follow_up_appointments: [], abstained: true }; }
  }

  // ── Sprint 123: AI Self-Learning Hardening ────────────────────────────
  async runShadowEval(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('self_learning', '/self-learning/shadow-eval', payload, 5000, tenantId); }
    catch { return { divergence_flagged: false, abstained: true }; }
  }

  async runBiasAudit(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('self_learning', '/self-learning/bias-audit', payload, 6000, tenantId); }
    catch { return { bias_report: [], abstained: true }; }
  }

  async detectAuditAnomalies(payload: any, tenantId?: string): Promise<any> {
    try { return await this.postWithPolicy<any>('self_learning', '/self-learning/audit-anomaly', payload, 5000, tenantId); }
    catch { return { anomalies: [], abstained: true }; }
  }

  async getModelVersions(tenantId?: string): Promise<Record<string, any>> {
    try {
      const res = await this.getWithPolicy<any>('ops', '/fl/model-version', 5000, tenantId, { surface: 'all' });
      return (res as any)?.versions ?? {};
    } catch {
      return {};
    }
  }

  async submitOutcomeFeedback(entries: any[], tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('outcome_feedback_submit', '/feedback/outcome', { entries }, 30000, tenantId);
  }

  async collectOutcomeFeedbackBatch(entries: any[], tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('outcome_feedback_collect', '/feedback/outcome/batch-collect', { entries }, 30000, tenantId);
  }

  async claimOutcomeFeedbackForLearning(limit: number = 25, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'outcome_feedback_claim',
      `/feedback/outcome/learning/claim?limit=${encodeURIComponent(String(limit))}`,
      {},
      30000,
      tenantId,
    );
  }

  async triggerOutcomeLearningRetraining(surface: string, entries: any[], tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'outcome_feedback_retrain',
      '/feedback/outcome/learning/retrain',
      { surface, entries },
      30000,
      tenantId,
    );
  }

  async getModelVersion(surface: string = 'all', tenantId?: string): Promise<any> {
    return this.getWithPolicy<any>('model_version', '/fl/model-version', 5000, tenantId, { surface });
  }

  async trainFederatedLocalModel(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('federated_train_local', '/fl/train-local', payload, 120000, tenantId);
  }

  async aggregateFederatedRound(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('federated_aggregate', '/fl/aggregate', payload, 60000, tenantId);
  }

  async evaluateFederatedModel(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('federated_evaluate', '/fl/evaluate', payload, 60000, tenantId);
  }

  async loadCdssModel(modelName: string, minioPath: string, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>('model_load', '/model/load', { modelName, minioPath }, 30000, tenantId);
  }

  async ingestKnowledgeDocument(payload: {
    documentId: string;
    tenantId: string;
    fileBase64: string;
    mimeType: string;
    metadata: Record<string, any>;
  }): Promise<{ chunkCount: number; embeddingModel: string }> {
    const response = await this.postWithPolicy<any>('knowledge_ingest', '/knowledge/ingest', {
      document_id: payload.documentId,
      tenant_id: payload.tenantId,
      file_base64: payload.fileBase64,
      mime_type: payload.mimeType,
      metadata: payload.metadata,
    }, 120000, payload.tenantId);
    return { chunkCount: response.chunk_count, embeddingModel: response.embedding_model };
  }

  async searchKnowledge(query: string, tenantId: string, filters?: {
    specialty?: string;
    documentType?: string;
    topK?: number;
  }): Promise<any[]> {
    await this.recordGovernedPromptAudit({ useCase: 'knowledge_search', source: 'rag_retrieval', tenantId });
    const response = await this.postWithPolicy<any>('knowledge_search', '/knowledge/search', {
      query,
      tenant_id: tenantId,
      filters: filters || {},
      top_k: filters?.topK || 5,
    }, 15000, tenantId);
    return response.results || [];
  }

  async proactiveAnalysis(payload: Record<string, any>, tenantId?: string, tenantDb?: DataSource): Promise<any> {
    try {
      const responseData = await this.postWithPolicy<any>(
        'patient_proactive_analysis',
        '/patient/analyze/proactive',
        payload,
        15000,
        tenantId,
      );

      await this.recordGovernedPromptAudit({
        tenantDb,
        tenantId,
        useCase: 'patient_proactive_analysis',
        source: 'cdss_service',
        model: String(responseData?.model_version || responseData?.model || 'patient_proactive_analysis_proxy'),
        patientId: payload?.patient_id || payload?.patientId || null,
        requestBody: {
          age: payload?.age ?? null,
          gender: payload?.gender || null,
          chronicConditionCount: Array.isArray(payload?.chronic_conditions) ? payload.chronic_conditions.length : 0,
          medicationCount: Array.isArray(payload?.active_medications) ? payload.active_medications.length : 0,
          recentDiagnosisCount: Array.isArray(payload?.recent_diagnoses) ? payload.recent_diagnoses.length : 0,
          triggerType: payload?.trigger_type || null,
        },
        responseSummary: {
          alertCount: Array.isArray(responseData?.active_alerts) ? responseData.active_alerts.length : 0,
          careGapCount: Array.isArray(responseData?.care_gaps) ? responseData.care_gaps.length : 0,
          modelVersion: responseData?.model_version || null,
          abstained: responseData?.abstained === true,
        },
        governance: responseData?.governance || {},
      });

      return responseData;
    } catch (err) {
      this.logger.warn(`proactiveAnalysis CDSS call failed: ${(err as any).message}`);
      return null;
    }
  }

  /* Sprint 149: NHIF / CBHI CDSS Methods */

  async nhifCheckEligibility(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'nhif_eligibility_check',
      '/nhif/eligibility/check',
      payload,
      10000,
      tenantId,
    );
  }

  async nhifCalculateCopay(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'nhif_copay_calculation',
      '/nhif/billing/calculate-copay',
      payload,
      10000,
      tenantId,
    );
  }

  /* Sprint 153: NTD Clinical Depth Methods */

  async ntdLeprosyMdt(payload: any, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'ntd_leprosy_mdt',
      '/cdss/ntd/leprosy-mdt',
      payload,
      15000,
      tenantId,
    );
  }

  async ntdFilariasisSafety(payload: any, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'ntd_filariasis_safety',
      '/cdss/ntd/filariasis-safety',
      payload,
      15000,
      tenantId,
    );
  }

  /** Sprint 160 — WHO UHC Service Coverage gap analysis */
  async uhcGapAnalysis(
    payload: {
      indicators: Record<string, number>;
      targets: Record<string, number>;
      facility_type?: string;
      country?: string;
      year: number;
    },
    tenantId?: string,
  ): Promise<any> {
    return this.postWithPolicy<any>(
      'uhc_gap_analysis',
      '/cdss/analytics/uhc-gap-analysis',
      payload,
      30000,
      tenantId,
    );
  }

  /** Sprint 161 — NCID duplicate scoring */
  async ncidDuplicateScore(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'ncid_duplicate_score',
      '/cdss/ncid/duplicate-score',
      payload,
      30000,
      tenantId,
    );
  }

  /** Sprint 161 — NCID programme gap analysis */
  async ncidProgrammeGaps(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'ncid_programme_gaps',
      '/cdss/ncid/programme-gaps',
      payload,
      30000,
      tenantId,
    );
  }

  /** Sprint 161 — NCID national ID format validation */
  async ncidValidateId(payload: Record<string, any>, tenantId?: string): Promise<any> {
    return this.postWithPolicy<any>(
      'ncid_validate_id',
      '/cdss/ncid/validate-id',
      payload,
      15000,
      tenantId,
    );
  }

  async getCorpusCoverage(ownerToken: string): Promise<any> {
    return this.getWithPolicy<any>('corpus_coverage', '/admin/corpus/coverage', 30000);
  }

  async getCorpusDocuments(ownerToken: string, domain?: string): Promise<any> {
    return this.getWithPolicy<any>('corpus_documents', `/admin/corpus/documents${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`, 30000);
  }

  async getCorpusStats(ownerToken: string): Promise<any> {
    return this.getWithPolicy<any>('corpus_stats', '/admin/corpus/stats', 15000);
  }

  async getIngestJobs(ownerToken: string, limit = 20): Promise<any> {
    return this.getWithPolicy<any>('ingest_jobs', `/admin/ingest/jobs?limit=${limit}`, 15000);
  }

  async getIngestStatus(jobId: string): Promise<any> {
    return this.getWithPolicy<any>('ingest_status', `/admin/ingest/status/${jobId}`, 15000);
  }

  async getIngestHistory(ownerToken: string, limit = 100, query?: string): Promise<any> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (query) qs.set('query', query);
    return this.getWithPolicy<any>('ingest_history', `/admin/ingest/history?${qs}`, 15000);
  }

  async parseClinicalNarrative(
    text: string,
    db?: any,
    opts?: { patientId?: number; encounterId?: number },
  ): Promise<Partial<ClinicalEntities>> {
    if (this.clinicalNlp) {
      return this.clinicalNlp.extractEntities(
        text,
        { context: 'cdss_narrative', patientId: opts?.patientId, encounterId: opts?.encounterId },
        db,
      );
    }
    return {};
  }
}
