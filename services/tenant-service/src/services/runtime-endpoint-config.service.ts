import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

type RuntimeEndpointConfigRow = {
  scope_key: string;
  tenant_service_url: string | null;
  ehr_service_url: string | null;
  cdss_service_url: string | null;
  medical_aid_demo_url: string | null;
  super_admin_web_url: string | null;
  ehr_frontend_url: string | null;
  ollama_base_url: string | null;
  whisper_path: string | null;
  ocr_path: string | null;
  ollama_tags_path: string | null;
  updated_at: Date | string;
};

export interface RuntimeEndpointConfigView {
  tenantServiceUrl: string;
  ehrServiceUrl: string;
  cdssServiceUrl: string;
  medicalAidDemoUrl: string;
  superAdminWebUrl: string;
  ehrFrontendUrl: string;
  ollamaBaseUrl: string;
  whisperPath: string;
  ocrPath: string;
  ollamaTagsPath: string;
  hasOverrides: boolean;
  sources: Record<string, 'override' | 'env'>;
  updatedAt: string;
}

export interface UpdateRuntimeEndpointConfigInput {
  tenantServiceUrl?: string | null;
  ehrServiceUrl?: string | null;
  cdssServiceUrl?: string | null;
  medicalAidDemoUrl?: string | null;
  superAdminWebUrl?: string | null;
  ehrFrontendUrl?: string | null;
  ollamaBaseUrl?: string | null;
  whisperPath?: string | null;
  ocrPath?: string | null;
  ollamaTagsPath?: string | null;
}

@Injectable()
export class RuntimeEndpointConfigService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeEndpointConfigService.name);
  private readonly scopeKey = 'global';
  private initPromise: Promise<void> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  async getConfig(): Promise<RuntimeEndpointConfigView> {
    await this.ensureInitialized();
    const row = await this.getConfigRow();
    return this.toView(row);
  }

  async updateConfig(
    input: UpdateRuntimeEndpointConfigInput,
    updatedBy?: string,
  ): Promise<RuntimeEndpointConfigView> {
    await this.ensureInitialized();
    const current = await this.getConfigRow();

    const next = {
      tenantServiceUrl: this.resolveIncomingValue(input.tenantServiceUrl, current.tenant_service_url, 'url'),
      ehrServiceUrl: this.resolveIncomingValue(input.ehrServiceUrl, current.ehr_service_url, 'url'),
      cdssServiceUrl: this.resolveIncomingValue(input.cdssServiceUrl, current.cdss_service_url, 'url'),
      medicalAidDemoUrl: this.resolveIncomingValue(input.medicalAidDemoUrl, current.medical_aid_demo_url, 'url'),
      superAdminWebUrl: this.resolveIncomingValue(input.superAdminWebUrl, current.super_admin_web_url, 'url'),
      ehrFrontendUrl: this.resolveIncomingValue(input.ehrFrontendUrl, current.ehr_frontend_url, 'url'),
      ollamaBaseUrl: this.resolveIncomingValue(input.ollamaBaseUrl, current.ollama_base_url, 'url'),
      whisperPath: this.resolveIncomingValue(input.whisperPath, current.whisper_path, 'path'),
      ocrPath: this.resolveIncomingValue(input.ocrPath, current.ocr_path, 'path'),
      ollamaTagsPath: this.resolveIncomingValue(input.ollamaTagsPath, current.ollama_tags_path, 'path'),
    };

    await this.dataSource.query(
      `
      UPDATE runtime_endpoint_configs
      SET
        tenant_service_url = $2,
        ehr_service_url = $3,
        cdss_service_url = $4,
        medical_aid_demo_url = $5,
        super_admin_web_url = $6,
        ehr_frontend_url = $7,
        ollama_base_url = $8,
        whisper_path = $9,
        ocr_path = $10,
        ollama_tags_path = $11,
        updated_by = $12,
        updated_at = NOW()
      WHERE scope_key = $1
      `,
      [
        this.scopeKey,
        next.tenantServiceUrl,
        next.ehrServiceUrl,
        next.cdssServiceUrl,
        next.medicalAidDemoUrl,
        next.superAdminWebUrl,
        next.ehrFrontendUrl,
        next.ollamaBaseUrl,
        next.whisperPath,
        next.ocrPath,
        next.ollamaTagsPath,
        updatedBy || null,
      ],
    );

    return this.getConfig();
  }

  private resolveIncomingValue(
    incoming: string | null | undefined,
    current: string | null,
    type: 'url' | 'path',
  ): string | null {
    if (incoming === undefined) {
      return current;
    }
    if (incoming === null) {
      return null;
    }

    const normalized = String(incoming || '').trim();
    if (!normalized) {
      return null;
    }

    if (type === 'url') {
      return this.validateUrl(normalized);
    }
    return this.validatePath(normalized);
  }

  private validateUrl(value: string): string {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(`Invalid URL: ${value}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(`URL must use http or https: ${value}`);
    }
    return value.replace(/\/+$/, '');
  }

  private validatePath(value: string): string {
    if (/^https?:\/\//i.test(value)) {
      return this.validateUrl(value);
    }
    const normalized = value.startsWith('/') ? value : `/${value}`;
    if (normalized.length > 512) {
      throw new BadRequestException('Path value is too long');
    }
    return normalized;
  }

  private defaults() {
    return {
      tenantServiceUrl: process.env.SERVICE_TENANT_URL || 'http://tenant-service:3001',
      ehrServiceUrl: process.env.SERVICE_EHR_URL || 'http://ehr-service:3013',
      cdssServiceUrl: process.env.SERVICE_CDSS_URL || 'http://cdss-service:8000',
      medicalAidDemoUrl: process.env.MEDICAL_AID_DEMO_BASE_URL || 'http://medical-aid-demo-service:3004',
      superAdminWebUrl: process.env.SUPER_ADMIN_WEB_URL || 'http://web-app:3011',
      ehrFrontendUrl: process.env.EHR_FRONTEND_URL || 'http://ehr-frontend:3000',
      ollamaBaseUrl: process.env.LLM_API_URL || 'http://host.docker.internal:11434',
      whisperPath: '/transcribe/basic?generate_soap=false',
      ocrPath: '/analyze-image',
      ollamaTagsPath: '/api/tags',
    };
  }

  private toView(row: RuntimeEndpointConfigRow): RuntimeEndpointConfigView {
    const defaults = this.defaults();
    const isOverride = (value: string | null | undefined): boolean =>
      typeof value === 'string' && value.trim().length > 0;
    const pick = (overrideValue: string | null | undefined, fallback: string): string =>
      isOverride(overrideValue) ? String(overrideValue).trim() : fallback;

    const sources: Record<string, 'override' | 'env'> = {
      tenantServiceUrl: isOverride(row.tenant_service_url) ? 'override' : 'env',
      ehrServiceUrl: isOverride(row.ehr_service_url) ? 'override' : 'env',
      cdssServiceUrl: isOverride(row.cdss_service_url) ? 'override' : 'env',
      medicalAidDemoUrl: isOverride(row.medical_aid_demo_url) ? 'override' : 'env',
      superAdminWebUrl: isOverride(row.super_admin_web_url) ? 'override' : 'env',
      ehrFrontendUrl: isOverride(row.ehr_frontend_url) ? 'override' : 'env',
      ollamaBaseUrl: isOverride(row.ollama_base_url) ? 'override' : 'env',
      whisperPath: isOverride(row.whisper_path) ? 'override' : 'env',
      ocrPath: isOverride(row.ocr_path) ? 'override' : 'env',
      ollamaTagsPath: isOverride(row.ollama_tags_path) ? 'override' : 'env',
    };

    const hasOverrides = Object.values(sources).some((source) => source === 'override');
    return {
      tenantServiceUrl: pick(row.tenant_service_url, defaults.tenantServiceUrl),
      ehrServiceUrl: pick(row.ehr_service_url, defaults.ehrServiceUrl),
      cdssServiceUrl: pick(row.cdss_service_url, defaults.cdssServiceUrl),
      medicalAidDemoUrl: pick(row.medical_aid_demo_url, defaults.medicalAidDemoUrl),
      superAdminWebUrl: pick(row.super_admin_web_url, defaults.superAdminWebUrl),
      ehrFrontendUrl: pick(row.ehr_frontend_url, defaults.ehrFrontendUrl),
      ollamaBaseUrl: pick(row.ollama_base_url, defaults.ollamaBaseUrl),
      whisperPath: pick(row.whisper_path, defaults.whisperPath),
      ocrPath: pick(row.ocr_path, defaults.ocrPath),
      ollamaTagsPath: pick(row.ollama_tags_path, defaults.ollamaTagsPath),
      hasOverrides,
      sources,
      updatedAt: this.toIsoOrNow(row.updated_at),
    };
  }

  private toIsoOrNow(value: unknown): string {
    const date = value instanceof Date ? value : value ? new Date(String(value)) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initializeInternal().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    await this.initPromise;
  }

  private async initializeInternal(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS runtime_endpoint_configs (
          scope_key VARCHAR(32) PRIMARY KEY,
          tenant_service_url TEXT NULL,
          ehr_service_url TEXT NULL,
          cdss_service_url TEXT NULL,
          medical_aid_demo_url TEXT NULL,
          super_admin_web_url TEXT NULL,
          ehr_frontend_url TEXT NULL,
          ollama_base_url TEXT NULL,
          whisper_path TEXT NULL,
          ocr_path TEXT NULL,
          ollama_tags_path TEXT NULL,
          updated_by UUID NULL REFERENCES admin_users(id),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      await this.dataSource.query(
        `
        INSERT INTO runtime_endpoint_configs (scope_key)
        VALUES ($1)
        ON CONFLICT (scope_key) DO NOTHING
        `,
        [this.scopeKey],
      );
    } catch (error: any) {
      this.logger.error(`Failed to initialize runtime endpoint config: ${error?.message || error}`);
      throw new InternalServerErrorException('Could not initialize runtime endpoint configuration');
    }
  }

  private async getConfigRow(): Promise<RuntimeEndpointConfigRow> {
    const rows = (await this.dataSource.query(
      `
      SELECT *
      FROM runtime_endpoint_configs
      WHERE scope_key = $1
      LIMIT 1
      `,
      [this.scopeKey],
    )) as RuntimeEndpointConfigRow[];

    if (!rows[0]) {
      throw new InternalServerErrorException('Runtime endpoint configuration row missing');
    }
    return rows[0];
  }
}
