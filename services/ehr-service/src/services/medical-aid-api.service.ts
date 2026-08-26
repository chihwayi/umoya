import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';

export interface MedicalAidApiConfig {
  id?: string;
  medicalAidName: string;
  providerType: 'cimas' | 'premier' | 'econet_health' | 'psmas' | 'other';
  apiBaseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  authenticationType: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  authEndpoint?: string;
  tokenEndpoint?: string;
  refreshTokenEndpoint?: string;
  claimSubmissionEndpoint?: string;
  statusCheckEndpoint?: string;
  preauthEndpoint?: string;
  memberVerificationEndpoint?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  requestTimeout?: number;
  retryCount?: number;
  retryDelay?: number;
  isActive?: boolean;
  configurationData?: any;
  testMode?: boolean;
}

export interface PreAuthorizationRequest {
  patientId: string;
  memberNumber: string;
  requestType: string;
  requestedAmount: number;
  diagnosisCodes?: string[];
  primaryDiagnosisCode?: string;
  procedureCodes?: string[];
  serviceCodes?: string[];
  clinicalNotes?: string;
}

export interface ClaimSubmissionRequest {
  claimId: string;
  patientId: string;
  memberNumber: string;
  claimAmount: number;
  diagnosisCodes?: string[];
  primaryDiagnosisCode?: string;
  procedureCodes?: string[];
  serviceCodes?: string[];
  claimData?: any;
}

@Injectable()
export class MedicalAidApiService {
  private readonly logger = new Logger(MedicalAidApiService.name);
  private apiClients = new Map<string, AxiosInstance>();
  private authTokens = new Map<string, { token: string; expiresAt: Date }>();

  private normalizeProviderName(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private mapProviderTypeFromName(name: string): MedicalAidApiConfig['providerType'] {
    const normalized = this.normalizeProviderName(name);
    if (normalized === 'cimas') return 'cimas';
    if (normalized === 'premier') return 'premier';
    if (normalized === 'econet_health' || normalized === 'econet-health' || normalized === 'econet health') {
      return 'econet_health';
    }
    if (normalized === 'psmas') return 'psmas';
    return 'other';
  }

  private getDemoProviderNames(): string[] {
    const configured = String(
      process.env.MEDICAL_AID_DEMO_PROVIDER_NAMES || 'cimas,premier,econet_health,psmas,first_mutual,demo_aid',
    );
    return configured
      .split(',')
      .map((item) => this.normalizeProviderName(item))
      .filter(Boolean);
  }

  private getDemoAuthType(): MedicalAidApiConfig['authenticationType'] {
    const configured = this.normalizeProviderName(process.env.MEDICAL_AID_DEMO_AUTH_TYPE || 'api_key');
    if (configured === 'api_key') return 'api_key';
    if (configured === 'bearer') return 'bearer';
    if (configured === 'basic') return 'basic';
    if (configured === 'oauth2') return 'oauth2';
    if (configured === 'custom') return 'custom';
    return 'api_key';
  }

  private getDemoFallbackConfiguration(medicalAidName: string): MedicalAidApiConfig | null {
    const enabled = this.normalizeProviderName(process.env.MEDICAL_AID_DEMO_ENABLED || 'true') !== 'false';
    if (!enabled) {
      return null;
    }

    const normalizedName = this.normalizeProviderName(medicalAidName);
    const allowedNames = this.getDemoProviderNames();
    if (!allowedNames.includes(normalizedName)) {
      return null;
    }

    const baseUrl = String(process.env.MEDICAL_AID_DEMO_BASE_URL || 'http://medical-aid-demo-service:3004').trim();
    const apiKey = process.env.MEDICAL_AID_DEMO_API_KEY || 'demo-medical-aid-key';

    if (!baseUrl) {
      return null;
    }

    return {
      medicalAidName,
      providerType: this.mapProviderTypeFromName(medicalAidName),
      apiBaseUrl: baseUrl,
      authenticationType: this.getDemoAuthType(),
      apiKey,
      claimSubmissionEndpoint: '/api/claims',
      statusCheckEndpoint: '/api/claims',
      preauthEndpoint: '/api/preauth',
      memberVerificationEndpoint: '/api/members/verify',
      requestTimeout: Number(process.env.MEDICAL_AID_DEMO_TIMEOUT_MS || 20000),
      retryCount: 2,
      retryDelay: 500,
      isActive: true,
      testMode: false,
      configurationData: {
        source: 'env-demo-fallback',
      },
    };
  }

  /**
   * Get API configuration for a medical aid provider
   */
  async getApiConfiguration(
    medicalAidName: string,
    tenantDb: DataSource,
  ): Promise<MedicalAidApiConfig | null> {
    const forceDemo = this.normalizeProviderName(process.env.MEDICAL_AID_DEMO_FORCE || 'false') === 'true';
    if (forceDemo) {
      const forcedFallback = this.getDemoFallbackConfiguration(medicalAidName);
      if (forcedFallback) {
        this.logger.log(`Using forced demo medical aid configuration for "${medicalAidName}".`);
        return forcedFallback;
      }
    }

    const [config] = await tenantDb.query(
      `SELECT * FROM medical_aid_api_configurations 
       WHERE medical_aid_name = $1 AND is_active = true`,
      [medicalAidName],
    );

    if (!config) {
      const fallbackConfig = this.getDemoFallbackConfiguration(medicalAidName);
      if (fallbackConfig) {
        this.logger.log(
          `Using demo medical aid fallback configuration for "${medicalAidName}" at ${fallbackConfig.apiBaseUrl}`,
        );
      }
      return fallbackConfig;
    }

    return {
      id: config.id,
      medicalAidName: config.medical_aid_name,
      providerType: config.provider_type,
      apiBaseUrl: config.api_base_url,
      apiKey: config.api_key,
      apiSecret: config.api_secret,
      authenticationType: config.authentication_type,
      authEndpoint: config.auth_endpoint,
      tokenEndpoint: config.token_endpoint,
      refreshTokenEndpoint: config.refresh_token_endpoint,
      claimSubmissionEndpoint: config.claim_submission_endpoint,
      statusCheckEndpoint: config.status_check_endpoint,
      preauthEndpoint: config.preauth_endpoint,
      memberVerificationEndpoint: config.member_verification_endpoint,
      webhookUrl: config.webhook_url,
      webhookSecret: config.webhook_secret,
      requestTimeout: config.request_timeout || 30000,
      retryCount: config.retry_count || 3,
      retryDelay: config.retry_delay || 1000,
      isActive: config.is_active,
      configurationData: config.configuration_data,
      testMode: config.test_mode || false,
    };
  }

  /**
   * Save or update API configuration
   */
  async saveApiConfiguration(
    config: MedicalAidApiConfig,
    tenantDb: DataSource,
  ): Promise<MedicalAidApiConfig> {
    const existing = await this.getApiConfiguration(config.medicalAidName, tenantDb);

    if (existing?.id) {
      // Update existing
      await tenantDb.query(
        `UPDATE medical_aid_api_configurations SET
          provider_type = $1,
          api_base_url = $2,
          api_key = $3,
          api_secret = $4,
          authentication_type = $5,
          auth_endpoint = $6,
          token_endpoint = $7,
          refresh_token_endpoint = $8,
          claim_submission_endpoint = $9,
          status_check_endpoint = $10,
          preauth_endpoint = $11,
          member_verification_endpoint = $12,
          webhook_url = $13,
          webhook_secret = $14,
          request_timeout = $15,
          retry_count = $16,
          retry_delay = $17,
          is_active = $18,
          configuration_data = $19,
          test_mode = $20,
          updated_at = NOW()
         WHERE id = $21`,
        [
          config.providerType,
          config.apiBaseUrl,
          config.apiKey || null,
          config.apiSecret || null,
          config.authenticationType,
          config.authEndpoint || null,
          config.tokenEndpoint || null,
          config.refreshTokenEndpoint || null,
          config.claimSubmissionEndpoint || null,
          config.statusCheckEndpoint || null,
          config.preauthEndpoint || null,
          config.memberVerificationEndpoint || null,
          config.webhookUrl || null,
          config.webhookSecret || null,
          config.requestTimeout || 30000,
          config.retryCount || 3,
          config.retryDelay || 1000,
          config.isActive !== false,
          JSON.stringify(config.configurationData || {}),
          config.testMode || false,
          existing.id,
        ],
      );
    } else {
      // Create new
      const [newConfig] = await tenantDb.query(
        `INSERT INTO medical_aid_api_configurations (
          medical_aid_name, provider_type, api_base_url, api_key, api_secret,
          authentication_type, auth_endpoint, token_endpoint, refresh_token_endpoint,
          claim_submission_endpoint, status_check_endpoint, preauth_endpoint,
          member_verification_endpoint, webhook_url, webhook_secret,
          request_timeout, retry_count, retry_delay, is_active, configuration_data, test_mode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *`,
        [
          config.medicalAidName,
          config.providerType,
          config.apiBaseUrl,
          config.apiKey || null,
          config.apiSecret || null,
          config.authenticationType,
          config.authEndpoint || null,
          config.tokenEndpoint || null,
          config.refreshTokenEndpoint || null,
          config.claimSubmissionEndpoint || null,
          config.statusCheckEndpoint || null,
          config.preauthEndpoint || null,
          config.memberVerificationEndpoint || null,
          config.webhookUrl || null,
          config.webhookSecret || null,
          config.requestTimeout || 30000,
          config.retryCount || 3,
          config.retryDelay || 1000,
          config.isActive !== false,
          JSON.stringify(config.configurationData || {}),
          config.testMode || false,
        ],
      );

      return this.getApiConfiguration(config.medicalAidName, tenantDb);
    }

    return this.getApiConfiguration(config.medicalAidName, tenantDb);
  }

  /**
   * Get authenticated API client for a medical aid provider
   */
  private async getAuthenticatedClient(
    config: MedicalAidApiConfig,
    tenantDb: DataSource,
  ): Promise<AxiosInstance> {
    const cacheKey = `${config.medicalAidName}_${config.providerType}`;

    // Check if client exists and is still valid
    if (this.apiClients.has(cacheKey)) {
      const token = this.authTokens.get(cacheKey);
      if (token && token.expiresAt > new Date()) {
        return this.apiClients.get(cacheKey);
      }
    }

    // Create new client
    const client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.requestTimeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Authenticate based on type
    try {
      await this.authenticateClient(client, config, tenantDb);
      this.apiClients.set(cacheKey, client);
    } catch (error: any) {
      this.logger.error(`Failed to authenticate with ${config.medicalAidName}: ${error.message}`);
      throw new BadRequestException(`Failed to authenticate with ${config.medicalAidName}`);
    }

    return client;
  }

  /**
   * Authenticate API client based on authentication type
   */
  private async authenticateClient(
    client: AxiosInstance,
    config: MedicalAidApiConfig,
    tenantDb: DataSource,
  ): Promise<void> {
    switch (config.authenticationType) {
      case 'api_key':
        if (config.apiKey) {
          client.defaults.headers.common['X-API-Key'] = config.apiKey;
        }
        if (config.apiSecret) {
          client.defaults.headers.common['X-API-Secret'] = config.apiSecret;
        }
        break;

      case 'bearer':
        if (config.apiKey) {
          client.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
        }
        break;

      case 'basic':
        if (config.apiKey && config.apiSecret) {
          const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
          client.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'oauth2':
        if (config.tokenEndpoint) {
          const tokenResponse = await axios.post(
            config.tokenEndpoint,
            {
              grant_type: 'client_credentials',
              client_id: config.apiKey,
              client_secret: config.apiSecret,
            },
            {
              timeout: config.requestTimeout || 30000,
            },
          );

          const accessToken = tokenResponse.data.access_token;
          const expiresIn = tokenResponse.data.expires_in || 3600;

          client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

          // Cache token
          this.authTokens.set(`${config.medicalAidName}_${config.providerType}`, {
            token: accessToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
          });
        }
        break;

      case 'custom':
        // Custom authentication logic based on configuration
        if (config.configurationData?.authMethod) {
          // Implement custom auth based on provider-specific requirements
          this.logger.warn(`Custom authentication not fully implemented for ${config.medicalAidName}`);
        }
        break;

      default:
        throw new BadRequestException(`Unsupported authentication type: ${config.authenticationType}`);
    }
  }

  /**
   * Verify member with medical aid provider
   */
  /** True when the request was routed to the local demo simulator instead of a
   * real payer, because no tenant-configured API credentials exist for this
   * provider. Callers must surface this — a claim "succeeding" against the
   * demo service will never be paid by a real medical aid. */
  private isSandboxConfig(config: MedicalAidApiConfig): boolean {
    return config.configurationData?.source === 'env-demo-fallback';
  }

  async verifyMember(
    medicalAidName: string,
    memberNumber: string,
    tenantDb: DataSource,
  ): Promise<{ valid: boolean; memberDetails?: any; error?: string; sandbox?: boolean }> {
    const config = await this.getApiConfiguration(medicalAidName, tenantDb);

    if (!config) {
      return { valid: false, error: 'API configuration not found for this medical aid' };
    }
    const sandbox = this.isSandboxConfig(config);

    if (config.testMode) {
      // Simulate verification in test mode
      return {
        valid: true,
        memberDetails: {
          memberNumber,
          name: 'Test Member',
          plan: 'Test Plan',
          status: 'active',
        },
        sandbox,
      };
    }

    try {
      const client = await this.getAuthenticatedClient(config, tenantDb);

      if (!config.memberVerificationEndpoint) {
        return { valid: false, error: 'Member verification endpoint not configured', sandbox };
      }

      const response = await client.post(config.memberVerificationEndpoint, {
        memberNumber,
      });

      return {
        valid: response.data.valid || response.data.status === 'active',
        memberDetails: response.data,
        sandbox,
      };
    } catch (error: any) {
      this.logger.error(`Member verification failed: ${error.message}`);
      return {
        valid: false,
        error: error.response?.data?.message || error.message,
        sandbox,
      };
    }
  }

  /**
   * Submit pre-authorization request
   */
  async submitPreAuthorization(
    medicalAidName: string,
    preAuthRequest: PreAuthorizationRequest,
    tenantDb: DataSource,
  ): Promise<{ success: boolean; preAuthId?: string; approvedAmount?: number; error?: string; sandbox?: boolean }> {
    const config = await this.getApiConfiguration(medicalAidName, tenantDb);

    if (!config) {
      return { success: false, error: 'API configuration not found' };
    }
    const sandbox = this.isSandboxConfig(config);

    if (config.testMode) {
      // Simulate pre-auth in test mode
      return {
        success: true,
        preAuthId: `PREAUTH-${Date.now()}`,
        approvedAmount: preAuthRequest.requestedAmount * 0.9, // 90% approval
        sandbox,
      };
    }

    try {
      const client = await this.getAuthenticatedClient(config, tenantDb);

      if (!config.preauthEndpoint) {
        return { success: false, error: 'Pre-authorization endpoint not configured', sandbox };
      }

      const payload = this.formatPreAuthPayload(preAuthRequest, config);
      const response = await client.post(config.preauthEndpoint, payload);

      return {
        success: response.data.approved || response.data.status === 'approved',
        preAuthId: response.data.preAuthId || response.data.referenceNumber,
        approvedAmount: response.data.approvedAmount,
        sandbox,
      };
    } catch (error: any) {
      this.logger.error(`Pre-authorization submission failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        sandbox,
      };
    }
  }

  /**
   * Submit claim to medical aid provider
   */
  async submitClaim(
    medicalAidName: string,
    claimRequest: ClaimSubmissionRequest,
    tenantDb: DataSource,
  ): Promise<{ success: boolean; externalClaimId?: string; error?: string; sandbox?: boolean }> {
    const config = await this.getApiConfiguration(medicalAidName, tenantDb);

    if (!config) {
      return { success: false, error: 'API configuration not found' };
    }
    const sandbox = this.isSandboxConfig(config);

    if (config.testMode) {
      // Simulate claim submission in test mode
      return {
        success: true,
        externalClaimId: `CLAIM-${Date.now()}`,
        sandbox,
      };
    }

    try {
      const client = await this.getAuthenticatedClient(config, tenantDb);

      if (!config.claimSubmissionEndpoint) {
        return { success: false, error: 'Claim submission endpoint not configured', sandbox };
      }

      const payload = this.formatClaimPayload(claimRequest, config);
      const response = await client.post(config.claimSubmissionEndpoint, payload);

      return {
        success: response.data.success || response.data.status === 'submitted',
        externalClaimId: response.data.claimId || response.data.referenceNumber,
        sandbox,
      };
    } catch (error: any) {
      this.logger.error(`Claim submission failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        sandbox,
      };
    }
  }

  /**
   * Check claim status from medical aid provider
   */
  async checkClaimStatus(
    medicalAidName: string,
    externalClaimId: string,
    tenantDb: DataSource,
  ): Promise<{ status: string; approvedAmount?: number; rejectionReason?: string; details?: any; sandbox?: boolean }> {
    const config = await this.getApiConfiguration(medicalAidName, tenantDb);

    if (!config) {
      throw new BadRequestException('API configuration not found');
    }
    const sandbox = this.isSandboxConfig(config);

    if (config.testMode) {
      // Simulate status check in test mode
      return {
        status: 'processing',
        details: { externalClaimId },
        sandbox,
      };
    }

    try {
      const client = await this.getAuthenticatedClient(config, tenantDb);

      if (!config.statusCheckEndpoint) {
        throw new BadRequestException('Status check endpoint not configured');
      }

      const response = await client.get(
        `${config.statusCheckEndpoint}/${externalClaimId}`,
      );

      return {
        status: response.data.status || 'processing',
        approvedAmount: response.data.approvedAmount,
        rejectionReason: response.data.rejectionReason,
        details: response.data,
        sandbox,
      };
    } catch (error: any) {
      this.logger.error(`Status check failed: ${error.message}`);
      throw new BadRequestException(
        error.response?.data?.message || error.message || 'Status check failed',
      );
    }
  }

  /**
   * Format pre-authorization payload based on provider type
   */
  private formatPreAuthPayload(
    request: PreAuthorizationRequest,
    config: MedicalAidApiConfig,
  ): any {
    // Provider-specific formatting
    switch (config.providerType) {
      case 'cimas':
        return {
          memberNumber: request.memberNumber,
          requestType: request.requestType,
          amount: request.requestedAmount,
          diagnosisCode: request.primaryDiagnosisCode,
          diagnosisCodes: request.diagnosisCodes,
          procedureCodes: request.procedureCodes,
          serviceCodes: request.serviceCodes,
          clinicalNotes: request.clinicalNotes,
        };

      case 'premier':
        return {
          member_number: request.memberNumber,
          request_type: request.requestType,
          requested_amount: request.requestedAmount,
          primary_diagnosis: request.primaryDiagnosisCode,
          diagnosis_codes: request.diagnosisCodes,
          procedure_codes: request.procedureCodes,
          notes: request.clinicalNotes,
        };

      case 'econet_health':
        return {
          memberNumber: request.memberNumber,
          type: request.requestType,
          amount: request.requestedAmount,
          diagnosis: {
            primary: request.primaryDiagnosisCode,
            all: request.diagnosisCodes,
          },
          procedures: request.procedureCodes,
          services: request.serviceCodes,
          clinicalNotes: request.clinicalNotes,
        };

      default:
        // Generic format
        return {
          memberNumber: request.memberNumber,
          requestType: request.requestType,
          requestedAmount: request.requestedAmount,
          diagnosisCodes: request.diagnosisCodes,
          primaryDiagnosisCode: request.primaryDiagnosisCode,
          procedureCodes: request.procedureCodes,
          serviceCodes: request.serviceCodes,
          clinicalNotes: request.clinicalNotes,
        };
    }
  }

  /**
   * Format claim payload based on provider type
   */
  private formatClaimPayload(
    request: ClaimSubmissionRequest,
    config: MedicalAidApiConfig,
  ): any {
    // Provider-specific formatting
    switch (config.providerType) {
      case 'cimas':
        return {
          memberNumber: request.memberNumber,
          claimAmount: request.claimAmount,
          diagnosisCode: request.primaryDiagnosisCode,
          diagnosisCodes: request.diagnosisCodes,
          procedureCodes: request.procedureCodes,
          serviceCodes: request.serviceCodes,
          claimData: request.claimData,
        };

      case 'premier':
        return {
          member_number: request.memberNumber,
          claim_amount: request.claimAmount,
          primary_diagnosis: request.primaryDiagnosisCode,
          diagnosis_codes: request.diagnosisCodes,
          procedure_codes: request.procedureCodes,
          service_codes: request.serviceCodes,
          details: request.claimData,
        };

      case 'econet_health':
        return {
          memberNumber: request.memberNumber,
          amount: request.claimAmount,
          diagnosis: {
            primary: request.primaryDiagnosisCode,
            all: request.diagnosisCodes,
          },
          procedures: request.procedureCodes,
          services: request.serviceCodes,
          claimDetails: request.claimData,
        };

      default:
        // Generic format
        return {
          memberNumber: request.memberNumber,
          claimAmount: request.claimAmount,
          diagnosisCodes: request.diagnosisCodes,
          primaryDiagnosisCode: request.primaryDiagnosisCode,
          procedureCodes: request.procedureCodes,
          serviceCodes: request.serviceCodes,
          claimData: request.claimData,
        };
    }
  }

  /**
   * Process webhook from medical aid provider
   */
  async processWebhook(
    medicalAidName: string,
    webhookData: any,
    signature: string,
    tenantDb: DataSource,
  ): Promise<{ processed: boolean; claimId?: string; error?: string }> {
    const config = await this.getApiConfiguration(medicalAidName, tenantDb);

    if (!config) {
      return { processed: false, error: 'API configuration not found' };
    }

    // Verify webhook signature if configured
    if (config.webhookSecret) {
      if (!signature) {
        this.logger.warn(`Webhook from ${medicalAidName} rejected: missing signature`);
        return { processed: false, error: 'Missing webhook signature' };
      }
      const body = typeof webhookData === 'string' ? webhookData : JSON.stringify(webhookData);
      const expected = createHmac('sha256', config.webhookSecret).update(body).digest('hex');
      // Accept both raw hex and "sha256=<hex>" prefixed formats (GitHub/Stripe style)
      const receivedHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
      let valid = false;
      try {
        valid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receivedHex, 'hex'));
      } catch {
        valid = false;
      }
      if (!valid) {
        this.logger.warn(`Webhook from ${medicalAidName} rejected: invalid HMAC signature`);
        return { processed: false, error: 'Invalid webhook signature' };
      }
      // Replay protection: require a timestamp field within 5 minutes
      const ts = webhookData?.timestamp ?? webhookData?.ts;
      if (ts && Math.abs(Date.now() - Number(ts)) > 300_000) {
        this.logger.warn(`Webhook from ${medicalAidName} rejected: replay (age ${Date.now() - Number(ts)}ms)`);
        return { processed: false, error: 'Webhook timestamp too old (replay protection)' };
      }
    }

    // Extract claim information from webhook
    const externalClaimId = webhookData.claimId || webhookData.referenceNumber;
    const status = webhookData.status || webhookData.claimStatus;

    // Find claim by external ID
    const [claim] = await tenantDb.query(
      `SELECT id FROM medical_aid_claims WHERE external_claim_id = $1`,
      [externalClaimId],
    );

    if (!claim) {
      this.logger.warn(`Claim not found for webhook: ${externalClaimId}`);
      return { processed: false, error: 'Claim not found' };
    }

    return {
      processed: true,
      claimId: claim.id,
    };
  }
}
