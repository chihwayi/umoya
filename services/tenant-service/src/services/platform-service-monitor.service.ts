import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import {
  RuntimeEndpointConfigService,
  RuntimeEndpointConfigView,
} from './runtime-endpoint-config.service';

type PlatformHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

type RuntimeTestId = 'whisper' | 'ocr' | 'ollama';

interface ManagedServiceDefinition {
  id: string;
  name: string;
  description: string;
  containerName?: string;
  healthUrls?: string[];
  restartable: boolean;
  restartTargetServiceId?: string;
}

interface RuntimeTestDefinition {
  id: RuntimeTestId;
  name: string;
  description: string;
  restartTargetServiceId?: string;
}

interface RuntimeTestResult {
  id: RuntimeTestId;
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  statusCode?: number;
  message: string;
  details?: Record<string, any>;
}

@Injectable()
export class PlatformServiceMonitorService {
  private readonly logger = new Logger(PlatformServiceMonitorService.name);
  private readonly dockerSocketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
  private readonly serviceProbeTimeoutMs = Number(process.env.SUPER_ADMIN_SERVICE_TIMEOUT_MS || 4500);

  constructor(private readonly runtimeEndpointConfigService: RuntimeEndpointConfigService) {}

  private readonly serviceDefinitions: ManagedServiceDefinition[] = [
    {
      id: 'tenant-service',
      name: 'Tenant Service',
      description: 'Provisioning, tenancy, and super admin APIs',
      containerName: process.env.CONTAINER_TENANT_SERVICE || 'umoya-tenant-service',
      restartable: true,
    },
    {
      id: 'ehr-service',
      name: 'EHR Service',
      description: 'Clinical workflows and EHR APIs',
      containerName: process.env.CONTAINER_EHR_SERVICE || 'umoya-ehr-service',
      restartable: true,
    },
    {
      id: 'cdss-service',
      name: 'CDSS Service',
      description: 'Clinical decision support, AI and inference APIs',
      containerName: process.env.CONTAINER_CDSS_SERVICE || 'umoya-cdss-service',
      restartable: true,
    },
    {
      id: 'cdss-worker',
      name: 'CDSS Worker',
      description: 'Background ingestion and async AI jobs',
      containerName: process.env.CONTAINER_CDSS_WORKER || 'umoya-cdss-worker',
      restartable: true,
    },
    {
      id: 'medical-aid-demo-service',
      name: 'Medical Aid Demo Service',
      description: 'Demo payer integration service',
      containerName: process.env.CONTAINER_MEDICAL_AID_DEMO || 'umoya-medical-aid-demo-service',
      restartable: true,
    },
    {
      id: 'web-app',
      name: 'Super Admin Frontend',
      description: 'Super admin web application',
      containerName: process.env.CONTAINER_WEB_APP || 'umoya-web-app',
      restartable: true,
    },
    {
      id: 'ehr-frontend',
      name: 'EHR Frontend',
      description: 'Tenant-facing clinical frontend',
      containerName: process.env.CONTAINER_EHR_FRONTEND || 'umoya-ehr-frontend',
      restartable: true,
    },
    {
      id: 'ollama',
      name: 'Ollama Runtime',
      description: 'Local LLM runtime used by AI workflows',
      containerName: process.env.CONTAINER_OLLAMA ? process.env.CONTAINER_OLLAMA : undefined,
      restartable: true,
    },
  ];

  private readonly runtimeTests: RuntimeTestDefinition[] = [
    {
      id: 'whisper',
      name: 'Whisper Transcription',
      description: 'Runs a demo audio transcription against CDSS whisper endpoint',
      restartTargetServiceId: 'cdss-service',
    },
    {
      id: 'ocr',
      name: 'OCR / Vision',
      description: 'Runs a demo image analysis request to verify OCR/vision path',
      restartTargetServiceId: 'cdss-service',
    },
    {
      id: 'ollama',
      name: 'Ollama LLM',
      description: 'Checks local LLM runtime model listing endpoint',
      restartTargetServiceId: 'ollama',
    },
  ];

  private readonly runtimeResults = new Map<RuntimeTestId, RuntimeTestResult>();

  async getPlatformServicesOverview() {
    const runtimeConfig = await this.runtimeEndpointConfigService.getConfig();
    const docker = await this.getDockerStatus();
    const definitions = this.resolveServiceDefinitions(runtimeConfig);
    const services = await Promise.all(
      definitions.map((definition) => this.buildServiceStatus(definition, docker.available)),
    );

    return {
      generatedAt: new Date().toISOString(),
      docker,
      runtimeConfig,
      services,
      runtimeTests: this.runtimeTests.map((test) => {
        const latest = this.runtimeResults.get(test.id);
        return {
          ...test,
          latest,
          health: latest
            ? latest.ok
              ? 'healthy'
              : 'degraded'
            : 'unknown',
        };
      }),
    };
  }

  async restartService(serviceId: string) {
    const definition = this.serviceDefinitions.find((item) => item.id === serviceId);
    if (!definition) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    if (!definition.restartable || !definition.containerName) {
      throw new Error(`Service ${serviceId} is not restartable from this panel`);
    }

    const docker = await this.getDockerStatus();
    if (!docker.available) {
      throw new Error(`Docker control unavailable: ${docker.error || 'socket not reachable'}`);
    }

    await this.dockerRequest(
      'POST',
      `/containers/${encodeURIComponent(definition.containerName)}/restart?t=10`,
      undefined,
      12_000,
    );

    return {
      serviceId,
      serviceName: definition.name,
      containerName: definition.containerName,
      restartedAt: new Date().toISOString(),
    };
  }

  async runRuntimeTest(testId: RuntimeTestId): Promise<RuntimeTestResult> {
    let result: RuntimeTestResult;

    if (testId === 'whisper') {
      result = await this.runWhisperTest();
    } else if (testId === 'ocr') {
      result = await this.runOcrTest();
    } else if (testId === 'ollama') {
      result = await this.runOllamaTest();
    } else {
      throw new Error(`Unknown runtime test: ${testId}`);
    }

    this.runtimeResults.set(testId, result);
    return result;
  }

  private resolveServiceDefinitions(runtimeConfig: RuntimeEndpointConfigView): ManagedServiceDefinition[] {
    const map: Record<string, string[]> = {
      'tenant-service': this.buildHealthTargets(runtimeConfig.tenantServiceUrl, '/api/docs'),
      'ehr-service': this.buildHealthTargets(runtimeConfig.ehrServiceUrl, '/api/tenants/active'),
      'cdss-service': this.buildHealthTargets(runtimeConfig.cdssServiceUrl, '/health'),
      'medical-aid-demo-service': this.buildHealthTargets(runtimeConfig.medicalAidDemoUrl, '/health'),
      'web-app': this.buildHealthTargets(runtimeConfig.superAdminWebUrl, ''),
      'ehr-frontend': this.buildHealthTargets(runtimeConfig.ehrFrontendUrl, ''),
      ollama: this.buildHealthTargets(runtimeConfig.ollamaBaseUrl, ''),
    };

    return this.serviceDefinitions.map((definition) => ({
      ...definition,
      healthUrls: map[definition.id] || definition.healthUrls,
    }));
  }

  private buildHealthTargets(baseUrl: string, path: string): string[] {
    const resolved = this.combineUrl(baseUrl, path);
    const targets = [resolved];
    const localhost = this.toLocalhostVariant(resolved);
    if (localhost && localhost !== resolved) {
      targets.push(localhost);
    }
    return Array.from(new Set(targets));
  }

  private combineUrl(baseUrl: string, path: string): string {
    const trimmedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!trimmedBase) return '';
    if (/^https?:\/\//i.test(path || '')) {
      return String(path).trim();
    }
    if (!path) {
      return trimmedBase;
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (trimmedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
      return `${trimmedBase}${normalizedPath.replace(/^\/api/, '')}`;
    }
    return `${trimmedBase}${normalizedPath}`;
  }

  private toLocalhostVariant(target: string): string | null {
    try {
      const parsed = new URL(target);
      if (!parsed.port) {
        return null;
      }
      parsed.hostname = 'localhost';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  private async buildServiceStatus(definition: ManagedServiceDefinition, dockerAvailable: boolean) {
    const container = definition.containerName
      ? await this.getContainerStatus(definition.containerName, dockerAvailable)
      : null;

    const endpoint = definition.healthUrls && definition.healthUrls.length > 0
      ? await this.probeHttpEndpoints(definition.healthUrls)
      : null;

    const health = this.resolveHealth(container, endpoint);

    return {
      ...definition,
      health,
      container,
      endpoint,
      checkedAt: new Date().toISOString(),
    };
  }

  private resolveHealth(
    container: { status: string; running: boolean; health?: string; error?: string } | null,
    endpoint: { reachable: boolean; statusCode?: number; latencyMs?: number; error?: string } | null,
  ): PlatformHealth {
    if (container && container.status !== 'unknown' && !container.running) {
      return 'down';
    }

    if (container?.running && container.health === 'unhealthy') {
      return 'degraded';
    }

    if (endpoint) {
      if (endpoint.reachable) {
        return 'healthy';
      }
      if (container?.running) {
        return 'degraded';
      }
      return 'down';
    }

    if (container?.running) {
      return 'healthy';
    }

    if (container && container.status !== 'unknown' && !container.running) {
      return 'down';
    }

    return 'unknown';
  }

  private async getDockerStatus(): Promise<{ available: boolean; socketPath: string; error?: string }> {
    try {
      await this.dockerRequest('GET', '/_ping', undefined, 2500);
      return {
        available: true,
        socketPath: this.dockerSocketPath,
      };
    } catch (error) {
      return {
        available: false,
        socketPath: this.dockerSocketPath,
        error: this.toErrorMessage(error),
      };
    }
  }

  private async getContainerStatus(containerName: string, dockerAvailable: boolean) {
    if (!dockerAvailable) {
      return {
        status: 'unknown',
        running: false,
        error: 'Docker socket unavailable',
      };
    }

    try {
      const inspect = await this.dockerRequest('GET', `/containers/${encodeURIComponent(containerName)}/json`);
      const state = inspect?.State || {};
      return {
        status: state?.Status || 'unknown',
        running: !!state?.Running,
        health: state?.Health?.Status,
        startedAt: state?.StartedAt,
        finishedAt: state?.FinishedAt,
      };
    } catch (error) {
      return {
        status: 'missing',
        running: false,
        error: this.toErrorMessage(error),
      };
    }
  }

  private async probeHttpEndpoints(targets: string[]) {
    const uniqueTargets = Array.from(new Set(targets.filter((item) => typeof item === 'string' && item.trim().length > 0)));
    if (uniqueTargets.length === 0) {
      return null;
    }

    let fallback: { reachable: boolean; url: string; statusCode?: number; latencyMs?: number; error?: string } | null = null;
    for (const target of uniqueTargets) {
      const attempt = await this.probeHttpEndpoint(target);
      if (attempt.reachable) {
        return attempt;
      }
      if (!fallback) {
        fallback = attempt;
      }
    }

    return fallback;
  }

  private async probeHttpEndpoint(target: string) {
    const started = Date.now();
    try {
      const { statusCode } = await this.httpRequest(target, 'GET', undefined, this.serviceProbeTimeoutMs);
      const ok = typeof statusCode === 'number' && statusCode < 500;
      return {
        reachable: ok,
        url: target,
        statusCode,
        latencyMs: Date.now() - started,
        error: ok ? undefined : `HTTP ${statusCode}`,
      };
    } catch (error) {
      return {
        reachable: false,
        url: target,
        latencyMs: Date.now() - started,
        error: this.toErrorMessage(error),
      };
    }
  }

  private async runWhisperTest(): Promise<RuntimeTestResult> {
    const started = Date.now();
    const runtimeConfig = await this.runtimeEndpointConfigService.getConfig();
    const endpoint = this.combineUrl(runtimeConfig.cdssServiceUrl, runtimeConfig.whisperPath);

    try {
      const headers: Record<string, string> = {
        'X-Tenant-ID': process.env.SUPER_ADMIN_TEST_TENANT_ID || 'kids-clinic',
      };

      const token = process.env.CDSS_SERVICE_TOKEN || 'dev_cdss_service_token_change_in_production';
      if (token && token.trim().length > 0) {
        headers['x-service-token'] = token.trim();
      }

      const body = this.buildMultipartBody('file', 'demo-whisper.wav', 'audio/wav', this.createSilentWav());
      const response = await this.httpRequest(endpoint, 'POST', {
        ...headers,
        'Content-Type': `multipart/form-data; boundary=${body.boundary}`,
      }, 25_000, body.buffer);

      const payload = this.safeParseJson(response.body);
      const ok = response.statusCode >= 200 && response.statusCode < 300;

      return {
        id: 'whisper',
        ok,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        statusCode: response.statusCode,
        message: ok ? 'Whisper transcription path is healthy' : this.extractErrorMessage(payload, response.body, response.statusCode),
        details: {
          endpoint,
          sampleTextLength: Number(payload?.transcription?.text?.length || 0),
        },
      };
    } catch (error) {
      return {
        id: 'whisper',
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        message: this.toErrorMessage(error),
        details: { endpoint },
      };
    }
  }

  private async runOcrTest(): Promise<RuntimeTestResult> {
    const started = Date.now();
    const runtimeConfig = await this.runtimeEndpointConfigService.getConfig();
    const endpoint = this.combineUrl(runtimeConfig.cdssServiceUrl, runtimeConfig.ocrPath);

    try {
      const headers: Record<string, string> = {
        'X-Tenant-ID': process.env.SUPER_ADMIN_TEST_TENANT_ID || 'kids-clinic',
      };

      const token = process.env.CDSS_SERVICE_TOKEN || 'dev_cdss_service_token_change_in_production';
      if (token && token.trim().length > 0) {
        headers['x-service-token'] = token.trim();
      }

      const image = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/lvA2LwAAAABJRU5ErkJggg==',
        'base64',
      );
      const body = this.buildMultipartBody('file', 'demo-ocr.png', 'image/png', image);

      const response = await this.httpRequest(endpoint, 'POST', {
        ...headers,
        'Content-Type': `multipart/form-data; boundary=${body.boundary}`,
      }, 25_000, body.buffer);

      const payload = this.safeParseJson(response.body);
      const ok = response.statusCode >= 200 && response.statusCode < 300;

      return {
        id: 'ocr',
        ok,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        statusCode: response.statusCode,
        message: ok ? 'OCR/vision inference path is healthy' : this.extractErrorMessage(payload, response.body, response.statusCode),
        details: {
          endpoint,
          findingsCount: Array.isArray(payload?.analysis?.findings) ? payload.analysis.findings.length : undefined,
        },
      };
    } catch (error) {
      return {
        id: 'ocr',
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        message: this.toErrorMessage(error),
        details: { endpoint },
      };
    }
  }

  private async runOllamaTest(): Promise<RuntimeTestResult> {
    const started = Date.now();
    const runtimeConfig = await this.runtimeEndpointConfigService.getConfig();
    const endpoint = this.combineUrl(runtimeConfig.ollamaBaseUrl, runtimeConfig.ollamaTagsPath);

    try {
      const response = await this.httpRequest(endpoint, 'GET', undefined, 8_000);
      const payload = this.safeParseJson(response.body);
      const ok = response.statusCode >= 200 && response.statusCode < 300;
      const modelCount = Array.isArray(payload?.models) ? payload.models.length : Array.isArray(payload?.data) ? payload.data.length : 0;

      return {
        id: 'ollama',
        ok,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        statusCode: response.statusCode,
        message: ok ? `LLM endpoint reachable (${modelCount} model${modelCount === 1 ? '' : 's'})` : this.extractErrorMessage(payload, response.body, response.statusCode),
        details: {
          endpoint,
          modelCount,
        },
      };
    } catch (error) {
      return {
        id: 'ollama',
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        message: this.toErrorMessage(error),
        details: { endpoint },
      };
    }
  }

  private createSilentWav(durationMs = 950, sampleRate = 16_000): Buffer {
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
    const dataSize = samples * channels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
    buffer.writeUInt16LE(channels * bytesPerSample, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
  }

  private buildMultipartBody(fieldName: string, filename: string, contentType: string, fileBuffer: Buffer) {
    const boundary = `----Umoya${Date.now().toString(16)}`;
    const top = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
      'utf8',
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    return {
      boundary,
      buffer: Buffer.concat([top, fileBuffer, tail]),
    };
  }

  private async dockerRequest(method: string, path: string, body?: string, timeoutMs = 7_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          method,
          socketPath: this.dockerSocketPath,
          path,
          timeout: timeoutMs,
          headers: {
            Host: 'docker',
            'Content-Type': 'application/json',
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const statusCode = response.statusCode || 500;
            if (statusCode >= 200 && statusCode < 300) {
              if (!raw) {
                resolve({});
                return;
              }
              try {
                resolve(JSON.parse(raw));
              } catch {
                resolve(raw);
              }
              return;
            }

            reject(new Error(`Docker API ${method} ${path} failed: ${statusCode}${raw ? ` ${raw}` : ''}`));
          });
        },
      );

      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error(`Docker API timeout for ${method} ${path}`)));
      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  private async httpRequest(
    target: string,
    method: 'GET' | 'POST',
    headers?: Record<string, string>,
    timeoutMs = 8_000,
    body?: Buffer,
  ): Promise<{ statusCode: number; body: string }> {
    const url = new URL(target);
    const client = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const request = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : undefined,
          path: `${url.pathname}${url.search}`,
          method,
          timeout: timeoutMs,
          headers: {
            Accept: 'application/json, text/plain, */*',
            ...(body ? { 'Content-Length': String(body.length) } : {}),
            ...(headers || {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode || 500,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );

      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error(`HTTP timeout for ${target}`)));
      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  private safeParseJson(raw: string): any {
    if (!raw || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private extractErrorMessage(payload: any, raw: string, statusCode: number): string {
    const detail = payload?.detail || payload?.message;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
    return `Request failed with status ${statusCode}${raw ? `: ${raw.slice(0, 180)}` : ''}`;
  }

  private toErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
