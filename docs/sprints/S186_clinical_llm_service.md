# S186 — ClinicalLlmService: HIPAA-Compliant General-Purpose LLM Infrastructure

**Phase:** 4 — True AI-First Foundation  
**Effort:** L (5–6 days)  
**Depends on:** S185 (follow-up scheduler), S171 (abstention transparency)  
**Blocks:** S187 (AI wiring sprint), S188 (clinical NLP)

---

## Problem

Every service built in S181–S185 (ClinicalSummaryService, CareGapEngineService, DrugSubstitutionService, FollowUpRecommendationService, ClinicalDocumentService) falls back to rule-based string construction because no general-purpose LLM generation method is available. `PostVisitGroundedLlmService.polishDoctorContent()` requires a full `PostVisitDoctorPolishInput` with `sessionId`, `soapNote`, `recommendationItems`, and `citations` — it is tightly coupled to the post-visit session model and cannot be called for standalone generation.

The result: MediCore has AI-shaped architecture but rule-powered execution. Every `ai_source = 'rule'` row in the DB proves it.

---

## Goal

Build a **stateless, general-purpose `ClinicalLlmService`** that:

1. Accepts a plain text prompt and returns generated text
2. Supports four HIPAA-eligible backends switchable via environment variable: **Ollama** (on-prem), **Azure OpenAI** (BAA available), **AWS Bedrock** (HIPAA eligible), **Anthropic Claude** (BAA available via enterprise)
3. Enforces a 15-second timeout with `AbstentionLogService` fallback on failure
4. Tracks which model generated each response (`ai_source` field)
5. Exposes a health check endpoint for ops monitoring
6. Is registered as a singleton provider so all S181–S185 services can inject it in S187

---

## HIPAA Model Selection Guide

| Backend | HIPAA Path | Config Key | Notes |
|---------|-----------|-----------|-------|
| **Ollama** (local) | On-prem — no PHI leaves the network | `CLINICAL_LLM_BACKEND=ollama` | Best for air-gapped or on-prem deployments |
| **Azure OpenAI** | Azure HIPAA BAA — PHI permitted under BAA | `CLINICAL_LLM_BACKEND=azure_openai` | GPT-4o or GPT-4-turbo; requires Azure subscription |
| **AWS Bedrock** | AWS HIPAA eligibility list — Claude 3.5 Sonnet available | `CLINICAL_LLM_BACKEND=aws_bedrock` | Uses Claude 3.5 Sonnet via Bedrock; requires AWS BAA |
| **Anthropic Direct** | Anthropic BAA (enterprise plan) | `CLINICAL_LLM_BACKEND=anthropic` | Claude 3.5 Sonnet; BAA signed at enterprise tier |

**Default for new deployments:** Ollama (no BAA required, zero data egress). Upgrade path: set `CLINICAL_LLM_BACKEND` without code changes.

---

## Database Provisioning

Add to `getProvisioningBundles()` in  
`services/tenant-service/src/services/database-provisioning.service.ts`

```typescript
{
  id: 'clinical_llm_audit',
  label: 'Sprint 186 — Clinical LLM Audit Log',
  version: '2026.05.28.1',
  description: 'Immutable audit trail for every ClinicalLlmService generation call',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS clinical_llm_audit (
      id          BIGSERIAL PRIMARY KEY,
      context     TEXT        NOT NULL,
      backend     TEXT        NOT NULL,
      model       TEXT        NOT NULL,
      prompt_hash TEXT        NOT NULL,
      output_len  INTEGER,
      latency_ms  INTEGER,
      success     BOOLEAN     NOT NULL DEFAULT TRUE,
      error_msg   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_llm_audit_context
       ON clinical_llm_audit(context, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_llm_audit_success
       ON clinical_llm_audit(success, created_at DESC)`,
  ],
},
```

---

## Environment Variables

Add to `.env.example` and deployment secrets:

```env
# ClinicalLlmService backend selection
CLINICAL_LLM_BACKEND=ollama            # ollama | azure_openai | aws_bedrock | anthropic

# Ollama (on-prem default)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Azure OpenAI (HIPAA BAA)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01

# AWS Bedrock (HIPAA eligible — Claude 3.5 Sonnet)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Anthropic Direct (enterprise BAA)
ANTHROPIC_API_KEY=<key>
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

---

## Backend — ClinicalLlmService

**File:** `services/ehr-service/src/services/clinical-llm.service.ts`

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { AbstentionLogService } from './abstention-log.service';

export interface LlmGenerateOptions {
  context: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmGenerateResult {
  text: string;
  model: string;
  backend: string;
  latencyMs: number;
}

type Backend = 'ollama' | 'azure_openai' | 'aws_bedrock' | 'anthropic';

@Injectable()
export class ClinicalLlmService {
  private readonly logger = new Logger(ClinicalLlmService.name);
  private readonly backend: Backend;
  private readonly timeoutMs = 15_000;

  constructor(
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {
    this.backend = (process.env.CLINICAL_LLM_BACKEND ?? 'ollama') as Backend;
  }

  async generate(
    prompt: string,
    opts: LlmGenerateOptions,
    db?: any,
  ): Promise<LlmGenerateResult | null> {
    const start = Date.now();
    const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);

    try {
      const result = await this.withTimeout(
        this.dispatchToBackend(prompt, opts),
        this.timeoutMs,
      );
      const latencyMs = Date.now() - start;

      if (db) {
        await this.auditLog(db, opts.context, result.backend, result.model,
          promptHash, result.text.length, latencyMs, true, null);
      }

      return { ...result, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const msg = err?.message ?? 'unknown error';
      this.logger.warn(`ClinicalLlmService [${this.backend}] failed: ${msg}`);

      if (db) {
        await this.auditLog(db, opts.context, this.backend, 'unknown',
          promptHash, null, latencyMs, false, msg);
        await this.abstentionLog?.log(db, `clinical_llm:${opts.context}`, 'timeout', {
          errorDetail: msg,
        });
      }

      return null;
    }
  }

  getBackend(): string {
    return this.backend;
  }

  isConfigured(): boolean {
    switch (this.backend) {
      case 'ollama':
        return !!process.env.OLLAMA_BASE_URL;
      case 'azure_openai':
        return !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);
      case 'aws_bedrock':
        return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      case 'anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      default:
        return false;
    }
  }

  private async dispatchToBackend(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    switch (this.backend) {
      case 'ollama':       return this.callOllama(prompt, opts);
      case 'azure_openai': return this.callAzureOpenAI(prompt, opts);
      case 'aws_bedrock':  return this.callAwsBedrock(prompt, opts);
      case 'anthropic':    return this.callAnthropic(prompt, opts);
      default:
        throw new Error(`Unknown CLINICAL_LLM_BACKEND: ${this.backend}`);
    }
  }

  private async callOllama(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          num_predict: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.3,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = await res.json() as { response: string };
    return { text: json.response.trim(), model, backend: 'ollama', latencyMs: 0 };
  }

  private async callAzureOpenAI(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const apiKey = process.env.AZURE_OPENAI_API_KEY!;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01';
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a concise clinical documentation assistant. Respond only with the requested text.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI HTTP ${res.status}`);
    const json = await res.json() as { choices: Array<{ message: { content: string } }> };
    const text = json.choices[0]?.message?.content?.trim() ?? '';
    return { text, model: deployment, backend: 'azure_openai', latencyMs: 0 };
  }

  private async callAwsBedrock(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const modelId = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    });
    const { signAwsRequest } = await import('../utils/aws-sig-v4');
    const headers = await signAwsRequest({
      method: 'POST',
      url,
      region,
      service: 'bedrock',
      body,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`AWS Bedrock HTTP ${res.status}`);
    const json = await res.json() as { content: Array<{ text: string }> };
    const text = json.content[0]?.text?.trim() ?? '';
    return { text, model: modelId, backend: 'aws_bedrock', latencyMs: 0 };
  }

  private async callAnthropic(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.3,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a concise clinical documentation assistant. Respond only with the requested text.',
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const json = await res.json() as { content: Array<{ text: string }> };
    const text = json.content[0]?.text?.trim() ?? '';
    return { text, model, backend: 'anthropic', latencyMs: 0 };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms),
      ),
    ]);
  }

  private async auditLog(
    db: any,
    context: string,
    backend: string,
    model: string,
    promptHash: string,
    outputLen: number | null,
    latencyMs: number,
    success: boolean,
    errorMsg: string | null,
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO clinical_llm_audit
           (context, backend, model, prompt_hash, output_len, latency_ms, success, error_msg)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [context, backend, model, promptHash, outputLen, latencyMs, success, errorMsg],
      );
    } catch {
      // Audit failure must never block the caller
    }
  }
}
```

---

## AWS SigV4 Utility

**File:** `services/ehr-service/src/utils/aws-sig-v4.ts`

```typescript
import { createHmac, createHash } from 'crypto';

interface SigV4Params {
  method: string;
  url: string;
  region: string;
  service: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export async function signAwsRequest(
  p: SigV4Params,
): Promise<Record<string, string>> {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const parsed = new URL(p.url);
  const host = parsed.host;

  const payloadHash = sha256Hex(p.body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = [
    p.method, parsed.pathname, '',
    canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const credScope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credScope, sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate    = hmacSha256(`AWS4${p.secretAccessKey}`, dateStamp);
  const kRegion  = hmacSha256(kDate, p.region);
  const kService = hmacSha256(kRegion, p.service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${credScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    Authorization: authorization,
  };
}
```

---

## Backend — ClinicalLlmController (Health Check)

**File:** `services/ehr-service/src/controllers/clinical-llm.controller.ts`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalLlmService } from '../services/clinical-llm.service';

@UseGuards(JwtAuthGuard)
@Controller('clinical-llm')
export class ClinicalLlmController {
  constructor(private readonly svc: ClinicalLlmService) {}

  @Get('health')
  health() {
    return {
      backend: this.svc.getBackend(),
      configured: this.svc.isConfigured(),
    };
  }
}
```

---

## Module Registration

**File:** `services/ehr-service/src/ehr.module.ts`

```typescript
import { ClinicalLlmService } from './services/clinical-llm.service';
import { ClinicalLlmController } from './controllers/clinical-llm.controller';

// In @Module:
providers: [...existingProviders, ClinicalLlmService],
controllers: [...existingControllers, ClinicalLlmController],
```

---

## Jest Spec

**File:** `services/ehr-service/src/services/clinical-llm.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ClinicalLlmService } from './clinical-llm.service';

describe('ClinicalLlmService', () => {
  let svc: ClinicalLlmService;
  let db: any;
  const origFetch = global.fetch;

  beforeEach(async () => {
    process.env.CLINICAL_LLM_BACKEND = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_MODEL = 'llama3.2:3b';
    const module = await Test.createTestingModule({
      providers: [ClinicalLlmService],
    }).compile();
    svc = module.get(ClinicalLlmService);
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  afterEach(() => { global.fetch = origFetch; });

  it('returns generated text from Ollama', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Patient has hypertension. ' }),
    } as any);

    const result = await svc.generate(
      'Summarise the patient in 1 sentence.',
      { context: 'clinical_summary', maxTokens: 128 },
      db,
    );

    expect(result).not.toBeNull();
    expect(result!.text).toBe('Patient has hypertension.');
    expect(result!.backend).toBe('ollama');
  });

  it('returns null and logs abstention on timeout', async () => {
    global.fetch = jest.fn().mockImplementation(
      () => new Promise(res => setTimeout(res, 20_000)),
    );
    jest.useFakeTimers();
    const generatePromise = svc.generate(
      'Summarise.',
      { context: 'clinical_summary' },
      db,
    );
    jest.advanceTimersByTime(16_000);
    const result = await generatePromise;
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('reports correct backend from getBackend()', () => {
    expect(svc.getBackend()).toBe('ollama');
  });

  it('reports isConfigured() = true when OLLAMA_BASE_URL is set', () => {
    expect(svc.isConfigured()).toBe(true);
  });

  it('reports isConfigured() = false when URL is missing', () => {
    delete process.env.OLLAMA_BASE_URL;
    const svc2 = new (ClinicalLlmService as any)(null);
    expect(svc2.isConfigured()).toBe(false);
  });
});
```

---

## Acceptance Criteria

1. `GET /clinical-llm/health` returns `{ backend: 'ollama', configured: true }` when `OLLAMA_BASE_URL` is set.
2. `ClinicalLlmService.generate()` calls the correct backend based on `CLINICAL_LLM_BACKEND`.
3. Switching `CLINICAL_LLM_BACKEND=azure_openai` routes to the Azure endpoint with `api-key` header.
4. Switching `CLINICAL_LLM_BACKEND=aws_bedrock` generates SigV4 `Authorization` header.
5. Switching `CLINICAL_LLM_BACKEND=anthropic` sends `x-api-key` header to `api.anthropic.com`.
6. LLM call exceeding 15 seconds returns `null` (not throws), logs abstention reason `'timeout'`.
7. Every successful call writes one row to `clinical_llm_audit` with `success = TRUE`.
8. Every failed call writes one row to `clinical_llm_audit` with `success = FALSE` and `error_msg` populated.
9. `ClinicalLlmService` is provided as a singleton — injectable by any service in `ehr.module.ts`.
10. `tsc --noEmit` passes; Jest spec 5/5 green.

---

## Definition of Done

- [ ] DB provisioning bundle `clinical_llm_audit` added with `CREATE TABLE IF NOT EXISTS`
- [ ] `ClinicalLlmService` implements all four backends behind single `generate()` interface
- [ ] AWS SigV4 utility at `src/utils/aws-sig-v4.ts` — no third-party signing library required
- [ ] 15-second timeout wraps every backend call via `Promise.race`
- [ ] `AbstentionLogService` logged on timeout with reason `'timeout'`
- [ ] Audit row written for every call (success and failure paths)
- [ ] `ClinicalLlmController` exposes `GET /clinical-llm/health`
- [ ] Environment variable guide documented in `.env.example`
- [ ] Module registration complete (providers + controllers)
- [ ] Jest spec: 5 tests passing
- [ ] `tsc --noEmit` clean in `ehr-service`
- [ ] Reviewer certification signed off
