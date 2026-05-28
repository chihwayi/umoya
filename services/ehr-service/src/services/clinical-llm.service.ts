import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
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
      result.latencyMs = latencyMs;

      if (db) {
        await this.auditLog(
          db, opts.context, result.backend, result.model,
          promptHash, result.text.length, latencyMs, true, null,
        );
      }

      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const msg = err?.message ?? 'unknown error';
      this.logger.warn(`ClinicalLlmService [${this.backend}] failed: ${msg}`);

      if (db) {
        await this.auditLog(
          db, opts.context, this.backend, 'unknown',
          promptHash, null, latencyMs, false, msg,
        );
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
        return !!(
          (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
          process.env.AWS_PROFILE
        );
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
      case 'ollama':        return this.callOllama(prompt, opts);
      case 'azure_openai':  return this.callAzureOpenAI(prompt, opts);
      case 'aws_bedrock':   return this.callAwsBedrock(prompt, opts);
      case 'anthropic':     return this.callAnthropic(prompt, opts);
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
    const url =
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'You are a concise clinical documentation assistant. ' +
              'Respond only with the requested text.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI HTTP ${res.status}`);
    const json = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = json.choices[0]?.message?.content?.trim() ?? '';
    return { text, model: deployment, backend: 'azure_openai', latencyMs: 0 };
  }

  private async callAwsBedrock(
    prompt: string,
    opts: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const modelId =
      process.env.BEDROCK_MODEL_ID ??
      'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    });
    const { accessKeyId, secretAccessKey } = this.resolveAwsCredentials();
    const { signAwsRequest } = await import('../utils/aws-sig-v4');
    const headers = await signAwsRequest({
      method: 'POST',
      url,
      region,
      service: 'bedrock',
      body,
      accessKeyId,
      secretAccessKey,
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
        system:
          'You are a concise clinical documentation assistant. ' +
          'Respond only with the requested text.',
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const json = await res.json() as { content: Array<{ text: string }> };
    const text = json.content[0]?.text?.trim() ?? '';
    return { text, model, backend: 'anthropic', latencyMs: 0 };
  }

  private resolveAwsCredentials(): { accessKeyId: string; secretAccessKey: string } {
    // Explicit env vars take priority (CI, Docker secrets, ECS task roles via injected env)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    // Named profile — reads ~/.aws/credentials (local dev + Docker with mounted volume)
    const profile = process.env.AWS_PROFILE ?? 'default';
    const credFile =
      process.env.AWS_SHARED_CREDENTIALS_FILE ?? join(homedir(), '.aws', 'credentials');

    let content: string;
    try {
      content = readFileSync(credFile, 'utf8');
    } catch {
      throw new Error(
        `AWS credentials not found. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY ` +
        `or ensure ~/.aws/credentials exists with profile [${profile}].`,
      );
    }

    const section = new RegExp(`\\[${profile}\\]([^\\[]*)`, 's').exec(content);
    if (!section) {
      throw new Error(`AWS profile '[${profile}]' not found in ${credFile}`);
    }

    const keyMatch = /aws_access_key_id\s*=\s*(\S+)/.exec(section[1]);
    const secretMatch = /aws_secret_access_key\s*=\s*(\S+)/.exec(section[1]);

    if (!keyMatch || !secretMatch) {
      throw new Error(
        `AWS profile '[${profile}]' is missing aws_access_key_id or aws_secret_access_key`,
      );
    }

    return { accessKeyId: keyMatch[1], secretAccessKey: secretMatch[1] };
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
