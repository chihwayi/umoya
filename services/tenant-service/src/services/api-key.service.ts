import { Injectable, BadRequestException, UnauthorizedException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import Redis from 'ioredis';
import { TenantApiKey } from '../entities/tenant-api-key.entity';
import { Tenant } from '../entities/tenant.entity';

const KEY_BYTES = 24; // 192 bits of entropy

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  // Redis-backed fixed-window limiter (atomic INCR+EXPIRE) — correct across
  // restarts and multiple instances. Falls back to per-process in-memory
  // counters if Redis is unreachable, so verification never hard-fails.
  private redis: Redis | null = null;
  private redisDown = false;
  private readonly rateBuckets = new Map<string, { minute: number; count: number }>();

  constructor(
    @InjectRepository(TenantApiKey)
    private readonly repo: Repository<TenantApiKey>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false });
        this.redis.on('error', (e) => {
          if (!this.redisDown) this.logger.warn(`Redis unavailable for rate limiting, falling back to in-memory: ${e.message}`);
          this.redisDown = true;
        });
        this.redis.on('ready', () => { this.redisDown = false; });
      } catch (e) {
        this.logger.warn(`Could not init Redis for rate limiting: ${e instanceof Error ? e.message : e}`);
        this.redis = null;
      }
    }
  }

  private tooMany(limitPerMin: number): never {
    throw new HttpException(
      { message: `API rate limit exceeded (${limitPerMin}/min for this tenant)`, retryAfterSeconds: 60 - Math.floor((Date.now() % 60000) / 1000) },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** In-memory fallback limiter (single process). */
  private enforceInMemory(tenantId: string, limitPerMin: number): { limit: number; remaining: number } {
    const minute = Math.floor(Date.now() / 60000);
    const bucket = this.rateBuckets.get(tenantId);
    if (!bucket || bucket.minute !== minute) {
      this.rateBuckets.set(tenantId, { minute, count: 1 });
      return { limit: limitPerMin, remaining: limitPerMin - 1 };
    }
    if (bucket.count >= limitPerMin) this.tooMany(limitPerMin);
    bucket.count += 1;
    return { limit: limitPerMin, remaining: limitPerMin - bucket.count };
  }

  /** Enforce the tenant's per-minute API limit. Throws 429 when exceeded. */
  private async enforceRateLimit(tenantId: string, limitPerMin: number): Promise<{ limit: number; remaining: number }> {
    if (!limitPerMin || limitPerMin <= 0) return { limit: 0, remaining: -1 }; // unlimited

    if (this.redis && !this.redisDown) {
      try {
        const minute = Math.floor(Date.now() / 60000);
        const key = `ratelimit:apikey:${tenantId}:${minute}`;
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, 60);
        if (count > limitPerMin) this.tooMany(limitPerMin);
        return { limit: limitPerMin, remaining: Math.max(0, limitPerMin - count) };
      } catch (e) {
        if (e instanceof HttpException) throw e; // a real 429
        this.redisDown = true; // connection issue → fall through to in-memory
      }
    }
    return this.enforceInMemory(tenantId, limitPerMin);
  }

  private hash(fullKey: string): string {
    return createHash('sha256').update(fullKey).digest('hex');
  }

  private safe(k: TenantApiKey) {
    const status = k.revokedAt
      ? 'revoked'
      : k.expiresAt && k.expiresAt.getTime() <= Date.now()
        ? 'expired'
        : 'active';
    return {
      id: k.id,
      tenantId: k.tenantId,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes || [],
      status,
      createdBy: k.createdBy,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
    };
  }

  async list(tenantId: string) {
    const keys = await this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return keys.map((k) => this.safe(k));
  }

  /**
   * Create a key. The full secret (`umoya_<prefix>_<secret>`) is returned ONCE
   * and never stored — only its hash + a display prefix are persisted.
   */
  async create(tenantId: string, opts: { name: string; scopes?: string[]; expiresAt?: string | null; createdBy?: string | null }) {
    if (!opts?.name?.trim()) throw new BadRequestException('A key name is required');

    const secret = randomBytes(KEY_BYTES).toString('base64url');
    const prefix = `umoya_${randomBytes(4).toString('hex')}`; // e.g. umoya_ab12cd34
    const fullKey = `${prefix}_${secret}`;

    let expiresAt: Date | null = null;
    if (opts.expiresAt) {
      const d = new Date(opts.expiresAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid expiry date');
      expiresAt = d;
    }

    const record = this.repo.create({
      tenantId,
      name: opts.name.trim(),
      keyPrefix: prefix,
      keyHash: this.hash(fullKey),
      scopes: Array.isArray(opts.scopes) ? opts.scopes : [],
      createdBy: opts.createdBy || null,
      expiresAt,
    });
    const saved = await this.repo.save(record);
    return { key: this.safe(saved), secret: fullKey }; // secret shown once
  }

  async revoke(tenantId: string, keyId: string) {
    const key = await this.repo.findOne({ where: { id: keyId, tenantId } });
    if (!key) throw new BadRequestException('API key not found');
    if (!key.revokedAt) {
      key.revokedAt = new Date();
      await this.repo.save(key);
    }
    return this.safe(key);
  }

  /**
   * Verify a presented key. Returns the owning tenant + scopes if valid,
   * else throws 401. Updates last-used. This is what makes the keys real:
   * any service/integration can authenticate an inbound API key here.
   */
  async verify(presentedKey: string): Promise<{ tenantId: string; scopes: string[]; keyId: string; rateLimit: { limit: number; remaining: number } }> {
    if (!presentedKey || !presentedKey.startsWith('umoya_')) {
      throw new UnauthorizedException('Invalid API key');
    }
    const key = await this.repo.findOne({ where: { keyHash: this.hash(presentedKey) } });
    if (!key) throw new UnauthorizedException('Invalid API key');
    if (key.revokedAt) throw new UnauthorizedException('API key has been revoked');
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Per-tenant rate limit (throws 429 when exceeded).
    const tenant = await this.tenantRepo.findOne({ where: { id: key.tenantId } });
    const limitPerMin = tenant?.apiRateLimitPerMin ?? 120;
    const rateLimit = await this.enforceRateLimit(key.tenantId, limitPerMin);

    // Best-effort last-used update (don't block verification on the write).
    key.lastUsedAt = new Date();
    this.repo.save(key).catch(() => undefined);
    return { tenantId: key.tenantId, scopes: key.scopes || [], keyId: key.id, rateLimit };
  }

  /** Read/update a tenant's API rate limit (requests/minute; 0 = unlimited). */
  async getRateLimit(tenantId: string): Promise<{ apiRateLimitPerMin: number }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    return { apiRateLimitPerMin: tenant.apiRateLimitPerMin ?? 120 };
  }

  async setRateLimit(tenantId: string, limitPerMin: number): Promise<{ apiRateLimitPerMin: number }> {
    const n = Number(limitPerMin);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      throw new BadRequestException('Rate limit must be between 0 (unlimited) and 100000');
    }
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    tenant.apiRateLimitPerMin = Math.floor(n);
    await this.tenantRepo.save(tenant);
    this.rateBuckets.delete(tenantId); // reset the window so the new limit applies now
    return { apiRateLimitPerMin: tenant.apiRateLimitPerMin };
  }
}
