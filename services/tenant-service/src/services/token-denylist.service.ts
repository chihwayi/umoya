import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Server-side JWT revocation. Admin tokens are stateless and otherwise stay valid
 * until `exp`; on logout (or forced revoke) we add the token's `jti` to a denylist
 * keyed with a TTL equal to the token's remaining lifetime, so the entry expires
 * exactly when the token would have anyway — no unbounded growth.
 *
 * Redis-backed so revocation holds across restarts and multiple instances; falls
 * back to a per-process in-memory set if Redis is unreachable (so logout still
 * works locally and auth never hard-fails on a Redis outage).
 */
@Injectable()
export class TokenDenylistService {
  private readonly logger = new Logger(TokenDenylistService.name);
  private redis: Redis | null = null;
  private redisDown = false;
  private readonly memory = new Map<string, number>(); // jti -> expiry epoch ms

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false });
        this.redis.on('error', (e) => {
          if (!this.redisDown) this.logger.warn(`Redis unavailable for token denylist, falling back to in-memory: ${e.message}`);
          this.redisDown = true;
        });
        this.redis.on('ready', () => { this.redisDown = false; });
      } catch (e) {
        this.logger.warn(`Could not init Redis for token denylist: ${e instanceof Error ? e.message : e}`);
        this.redis = null;
      }
    }
  }

  private key(jti: string): string {
    return `revoked:jwt:${jti}`;
  }

  /** Revoke a token by its `jti`. `ttlSeconds` should be the token's remaining lifetime. */
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (!jti) return;
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    if (this.redis && !this.redisDown) {
      try {
        await this.redis.set(this.key(jti), '1', 'EX', ttl);
        return;
      } catch (e) {
        this.redisDown = true;
      }
    }
    this.pruneMemory();
    this.memory.set(jti, Date.now() + ttl * 1000);
  }

  /** True if the token has been revoked (and not yet naturally expired). */
  async isRevoked(jti: string): Promise<boolean> {
    if (!jti) return false;
    if (this.redis && !this.redisDown) {
      try {
        return (await this.redis.exists(this.key(jti))) === 1;
      } catch (e) {
        this.redisDown = true;
      }
    }
    const exp = this.memory.get(jti);
    if (!exp) return false;
    if (exp <= Date.now()) {
      this.memory.delete(jti);
      return false;
    }
    return true;
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [jti, exp] of this.memory) {
      if (exp <= now) this.memory.delete(jti);
    }
  }
}
