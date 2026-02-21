import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as FormData from 'form-data';
import { WhoSmartGuidelinesService, GuidelineRecommendation } from './who-smart-guidelines.service';
import { createHash, createHmac, randomUUID } from 'crypto';
import { MetricsService } from './metrics.service';

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
  ) {
    this.cdssServiceUrl = process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000';
    this.cdssServiceToken = process.env.CDSS_SERVICE_TOKEN;
    this.cdssServiceJwtSecret = process.env.CDSS_SERVICE_JWT_SECRET || undefined;
    this.cdssServiceJwtIssuer = process.env.CDSS_SERVICE_AUTH_ISSUER || 'medicore.ehr-service';
    this.cdssServiceJwtAudience = process.env.CDSS_SERVICE_AUTH_AUDIENCE || 'medicore.cdss';
    const modeRaw = (process.env.CDSS_SERVICE_AUTH_MODE || 'both').toLowerCase();
    this.cdssServiceAuthMode = modeRaw === 'jwt' || modeRaw === 'token' ? modeRaw : 'both';
    this.defaultTimeoutMs = this.parsePositiveInt(process.env.CDSS_OUTBOUND_TIMEOUT_MS, 15000);
    this.retryMax = this.parsePositiveInt(process.env.CDSS_OUTBOUND_RETRY_MAX, 2);
    this.retryBaseDelayMs = this.parsePositiveInt(process.env.CDSS_OUTBOUND_RETRY_BASE_MS, 200);
    this.circuitFailureThreshold = this.parsePositiveInt(process.env.CDSS_CIRCUIT_BREAKER_FAIL_THRESHOLD, 5);
    this.circuitOpenMs = this.parsePositiveInt(process.env.CDSS_CIRCUIT_BREAKER_OPEN_MS, 30000);

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
          (request.headers as AxiosHeaders).set('X-Service-Token', this.cdssServiceToken);
        }
      }
      if (this.cdssServiceAuthMode === 'jwt' || this.cdssServiceAuthMode === 'both') {
        const serviceJwt = this.createServiceJwt(request.url, request.method);
        if (serviceJwt) {
          (request.headers as AxiosHeaders).set('Authorization', `Bearer ${serviceJwt}`);
        }
      }
      (request.headers as AxiosHeaders).set('X-Service-Name', 'ehr-service');
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

  private async postWithPolicy<T>(
    eventType: string,
    path: string,
    payload: any,
    timeoutMs: number,
    tenantId?: string,
  ): Promise<T> {
    this.ensureCircuitClosed(eventType);
    const startedAt = Date.now();
    const maxAttempts = this.retryMax + 1;
    let lastError: any;
    let retries = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.cdssClient.post(
          path,
          payload,
          this.buildCdssRequestConfig(timeoutMs, tenantId),
        );
        const durationSeconds = (Date.now() - startedAt) / 1000;
        this.metricsService?.recordCdssHook(eventType, 'success', durationSeconds);
        this.onCdssCallSuccess();
        return response.data as T;
      } catch (error: any) {
        lastError = error;
        const errorType = this.classifyCdssError(error);
        if (errorType === 'timeout') {
          this.metricsService?.recordCdssTimeout(eventType);
        }
        const retryable = this.isRetryableError(error);
        if (retryable && attempt < maxAttempts) {
          retries += 1;
          this.metricsService?.recordCdssRetry(eventType, errorType);
          const delayMs = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delayMs);
          continue;
        }

        const durationSeconds = (Date.now() - startedAt) / 1000;
        this.metricsService?.recordCdssHook(eventType, 'error', durationSeconds);
        this.metricsService?.recordCdssHookError(eventType, errorType);
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
   * Basic drug interaction checking (fallback) - DISABLED
   */
  private async basicDrugInteractionCheck(drugIds: string[]) {
    // Return empty result to avoid fake data
    return {
      hasInteractions: false,
      interactions: [],
      severity_summary: { critical: 0, major: 0, moderate: 0, minor: 0 },
      recommendations: [],
      source: 'fallback_empty',
    };
  }

  /**
   * Diagnostic assistance using Python CDSS service
   * Uses intelligent endpoint (rule-based + AI) if available, falls back to rule-based
   */
  async diagnosisAssist(symptoms: any, useIntelligent: boolean = true, tenantId?: string) {
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
              conditions: symptoms.conditions || symptoms.diagnoses || []
            },
            age: symptoms.age || undefined,
            gender: symptoms.gender || undefined,
              labs: symptoms.labs || undefined,
              conditions: symptoms.conditions || symptoms.diagnoses || undefined
            },
            20000,
            tenantId,
          );
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

  /**
   * Basic diagnostic assistance (fallback) - DISABLED
   */
  private async basicDiagnosisAssist(symptoms: any) {
    this.logger.warn(`[FALLBACK] Basic diagnosis assist triggered but disabled to prevent fake data.`);
    
    return {
      suggested_diagnoses: [],
      recommended_tests: [],
      red_flags: [],
      differentialDiagnoses: [],
      recommendedTests: [],
      urgencyLevel: 'unknown',
      source: 'fallback_empty',
      error: 'CDSS service unavailable'
    };
  }

  /**
   * Get clinical guidelines from Python CDSS service
   * Now integrates WHO Smart Guidelines if available
   */
  async getGuidelines(condition: string, patientData?: any, tenantId?: string) {
    // Try WHO Smart Guidelines first (if service available)
    if (this.whoSmartGuidelinesService) {
      try {
        const whoGuidelines = await this.whoSmartGuidelinesService.getRecommendations(condition, patientData);
        if (whoGuidelines && whoGuidelines.length > 0) {
          this.logger.log(`Using WHO Smart Guidelines for: ${condition}`);
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
            evidence_level: 'high', // WHO Smart Guidelines are evidence-based
            matched_condition: condition,
            source: 'who_smart_guidelines',
            whoGuidelines: whoGuidelines
          };
        }
      } catch (error: any) {
        this.logger.debug(`WHO Smart Guidelines not available: ${error.message}`);
        // Continue to CDSS guidelines
      }
    }
    
    // Fallback to CDSS guidelines
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
        },
        10000,
        tenantId,
      );

      return {
        guidelines: responseData.guidelines || [],
        recommendations: responseData.recommendations || [],
        contraindications: responseData.contraindications || [],
        medication_warnings: responseData.medication_warnings || [],
        evidence_level: responseData.evidence_level,
        matched_condition: responseData.matched_condition,
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS guidelines unavailable: ${error.message}`);
      // Fallback to basic guidelines
      return this.basicGetGuidelines(condition);
    }
  }

  /**
   * Search for clinical guidelines using RAG and WHO Smart Guidelines
   */
  async searchGuidelines(query: string, limit: number = 5, patientContext?: any, tenantId?: string) {
    const results = {
      query,
      citations: [],
      count: 0,
      error: null
    };

    try {
      // 1. Search WHO Smart Guidelines (Local)
      if (this.whoSmartGuidelinesService) {
        try {
          const whoResults = await this.whoSmartGuidelinesService.search(query);
          if (whoResults.length > 0) {
            results.citations.push(...whoResults.map(r => ({
              title: r.title,
              text: r.description || r.title,
              source: r.source,
              url: null,
              score: 1.0 // High confidence for local matches
            })));
          }
        } catch (err) {
          this.logger.warn(`WHO Smart Guidelines search failed: ${err.message}`);
        }
      }

      // 2. Search External CDSS (RAG)
      try {
        const responseData = await this.postWithPolicy<any>(
          'guidelines_search',
          '/guidelines/search',
          {
          query,
          limit,
          patient_context: patientContext
          },
          15000,
          tenantId,
        );
        if (responseData && responseData.citations) {
          results.citations.push(...responseData.citations);
        }
      } catch (error: any) {
        this.logger.warn(`CDSS guideline search failed: ${error.message}`);
      }
      
      // If no results found (either from WHO or CDSS), use fallback
      if (results.citations.length === 0) {
        this.logger.log('No guidelines found from external sources, using basic fallback');
        const fallback = this.basicSearchGuidelines(query);
        results.citations = fallback.citations;
      }
      
      results.count = results.citations.length;
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
      const response = await this.cdssClient.post('/analyze-image', formData, {
        timeout: 45000,
        headers,
      });
      const durationSeconds = (Date.now() - startedAt) / 1000;
      this.metricsService?.recordCdssHook('analyze_image', 'success', durationSeconds);
      this.onCdssCallSuccess();
      return response.data;
    } catch (error: any) {
      const durationSeconds = (Date.now() - startedAt) / 1000;
      const errorType = this.classifyCdssError(error);
      this.metricsService?.recordCdssHook('analyze_image', 'error', durationSeconds);
      this.metricsService?.recordCdssHookError('analyze_image', errorType);
      this.onCdssCallFailure();
      throw error;
    }
  }

  /**
   * Basic guideline search (fallback) - NOW DISABLED to prevent fake data
   */
  private basicSearchGuidelines(query: string) {
    // We intentionally return empty results here to avoid showing
    // hardcoded/outdated/fake guidelines when the AI service is down.
    this.logger.warn(`[FALLBACK] Basic search triggered for query "${query}" but disabled to prevent fake data.`);
    
    return {
      query,
      citations: [],
      count: 0,
      error: null
    };
  }

  /**
   * Basic guidelines (fallback) - NOW DISABLED to prevent fake data
   */
  private async basicGetGuidelines(condition: string) {
    // Return empty/generic structure to avoid hardcoded fake guidelines
    return {
      guidelines: [{ condition, guidelines: ['Guideline service unavailable'] }],
      recommendations: [],
      contraindications: [],
      medication_warnings: [],
      evidence_level: 'unknown',
      matched_condition: condition,
      source: 'fallback_empty',
    };
  }

  /**
   * Risk assessment using Python CDSS service with historical data
   */
  async riskAssessment(patientData: any, tenantDb?: DataSource, tenantId?: string) {
    try {
      const { patientId, age, gender, vitals, medicalHistory, medications, diagnoses, labResults } = patientData;
      
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
        medications: medications || [],
        diagnoses: diagnoses || medicalHistory || [],
        lab_results: labResults,
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
      return {
        has_duplicates: false, // Default to false but warn
        duplicates: [],
        warnings: ['CDSS service unavailable - duplicate check failed'],
        summary: { total_medications: medications.length },
        source: 'error'
      };
    }
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
      return {
        has_high_risk_medications: false, // Default to false but warn
        beers_criteria_alerts: [],
        stopp_criteria_alerts: [],
        high_alert_medications: [],
        summary: { total_medications: medications.length },
        warnings: ['CDSS service unavailable - high risk check failed'],
        source: 'error'
      };
    }
  }

  /**
   * Detect care gaps
   */
  async detectCareGaps(
    patientAge?: number,
    patientGender?: string,
    visitHistory?: any[],
    diagnoses?: string[]
  ) {
    try {
      const responseData = await this.postWithPolicy<any>(
        'care_gaps_detect',
        '/care-gaps/detect',
        {
        patient_age: patientAge,
        patient_gender: patientGender,
        visit_history: visitHistory || [],
        diagnoses: diagnoses || []
        },
        15000,
      );
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
   * Basic risk assessment (fallback) - DISABLED
   */
  private async basicRiskAssessment(patientData: any) {
    this.logger.warn(`[FALLBACK] Basic risk assessment triggered but disabled to prevent fake data.`);

    return {
      overall_score: 0,
      risk_level: 'unknown',
      factors: [],
      recommendations: [],
      source: 'fallback_empty',
      error: 'CDSS service unavailable'
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
    let systolic: number | null = null;
    let diastolic: number | null = null;
    if (typeof vitals.bloodPressure === 'string' && vitals.bloodPressure.includes('/')) {
      const [sys, dia] = vitals.bloodPressure.split('/').map((v: string) => parseInt(v.trim(), 10));
      systolic = Number.isFinite(sys) ? sys : null;
      diastolic = Number.isFinite(dia) ? dia : null;
    }
    if (vitals.systolic && Number.isFinite(Number(vitals.systolic))) {
      systolic = Number(vitals.systolic);
    }
    if (vitals.diastolic && Number.isFinite(Number(vitals.diastolic))) {
      diastolic = Number(vitals.diastolic);
    }

    const heartRate = Number.isFinite(Number(vitals.heartRate)) ? Number(vitals.heartRate) : null;
    const temperature = Number.isFinite(Number(vitals.temperature)) ? Number(vitals.temperature) : null;
    const oxygenSaturation = Number.isFinite(Number(vitals.oxygenSaturation)) ? Number(vitals.oxygenSaturation) : null;
    const respiratoryRate = Number.isFinite(Number(vitals.respiratoryRate)) ? Number(vitals.respiratoryRate) : null;

    return {
      systolic,
      diastolic,
      heartRate,
      temperature,
      oxygenSaturation,
      respiratoryRate,
    };
  }

  private applyVitalsSafetyOverrides(
    baseRisk: { risk_level?: string; recommendations?: string[]; factors?: any[]; model?: string } | null,
    vitalsRaw: any,
  ) {
    const vitals = this.normalizeVitalsForSafety(vitalsRaw);
    const factors: string[] = [];

    const highFever = vitals.temperature !== null && vitals.temperature >= 39;
    const severeFever = vitals.temperature !== null && vitals.temperature >= 40;
    const tachycardia = vitals.heartRate !== null && vitals.heartRate >= 130;
    const hypotension =
      (vitals.systolic !== null && vitals.systolic < 90) ||
      (vitals.diastolic !== null && vitals.diastolic < 60);
    const veryLowSpO2 =
      vitals.oxygenSaturation !== null && vitals.oxygenSaturation > 0 && vitals.oxygenSaturation < 90;

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
    if (veryLowSpO2) {
      factors.push(`Low oxygen saturation ${vitals.oxygenSaturation}%`);
    }

    let safetyLevel: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    const dangerSignals = [highFever, tachycardia, hypotension, veryLowSpO2].filter(Boolean).length;

    if (dangerSignals >= 2 || severeFever || (vitals.systolic !== null && vitals.systolic < 80)) {
      safetyLevel = 'critical';
    } else if (dangerSignals === 1) {
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
        'Critical vitals pattern detected: immediate clinical review required.',
        'Escalate to senior clinician or emergency response according to local protocol.',
        'Verify measurement accuracy (SpO2, respiratory rate) and repeat vitals urgently.',
      );
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
      const lower = rec.toLowerCase();
      if (lower.includes('readmission')) return false;
      if (lower.includes('discharge')) return false;
      if (lower.includes('follow-up')) return false;
      return true;
    });

    const combinedFactors = [
      ...(Array.isArray(baseRisk?.factors) ? baseRisk!.factors : []),
      ...factors.map((f) => ({ factor: f, impact: 'major' })),
    ];

    return {
      riskLevel: finalLevel,
      recommendations: [...acuteRecommendations, ...filteredBaseRecommendations],
      factors: combinedFactors,
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
      },
      true,
      tenantId,
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

  async generateNurseNoteDraft(payload: any, tenantId?: string) {
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

  async generateNurseHandoffSummary(payload: any, tenantId?: string) {
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
}
