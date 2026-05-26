import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface RuleContext {
  userId: string;
  userEmail: string;
  ipAddress: string;
  action: string;
  resource: string;
  timestamp: Date;
}

interface AnomalyResult {
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
}

interface AnomalyRule {
  name: string;
  severity: AnomalyResult['severity'];
  check: (ctx: RuleContext, db: any) => Promise<AnomalyResult | null>;
}

export const ANOMALY_RULES: AnomalyRule[] = [
  {
    name: 'BULK_DOWNLOAD',
    severity: 'high',
    async check(ctx, db) {
      const rows = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM hipaa_audit_logs
         WHERE user_id = $1 AND action LIKE '%_view' AND created_at > NOW() - INTERVAL '1 hour'`,
        [ctx.userId],
      );
      const cnt: number = rows[0]?.cnt ?? 0;
      if (cnt > 200) {
        return { rule: 'BULK_DOWNLOAD', severity: 'high', details: { count: cnt, window: '1h' } };
      }
      return null;
    },
  },
  {
    name: 'BRUTE_FORCE_LOGIN',
    severity: 'critical',
    async check(ctx, db) {
      if (ctx.action !== 'login_failed') return null;
      const rows = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM hipaa_audit_logs
         WHERE user_name = $1 AND action = 'login_failed' AND created_at > NOW() - INTERVAL '5 minutes'`,
        [ctx.userEmail],
      );
      const cnt: number = rows[0]?.cnt ?? 0;
      if (cnt > 10) {
        return { rule: 'BRUTE_FORCE_LOGIN', severity: 'critical', details: { attempts: cnt, window: '5m' } };
      }
      return null;
    },
  },
  {
    name: 'AFTER_HOURS_SENSITIVE_ACCESS',
    severity: 'medium',
    async check(ctx, _db) {
      const hour = ctx.timestamp.getHours();
      const sensitiveResources = ['patients', 'hiv_enrollment', 'lab_result', 'cdpa'];
      const isSensitive = sensitiveResources.some((r) => ctx.resource.includes(r));
      if (hour >= 0 && hour < 5 && isSensitive) {
        return {
          rule: 'AFTER_HOURS_SENSITIVE_ACCESS',
          severity: 'medium',
          details: { hour, resource: ctx.resource, action: ctx.action },
        };
      }
      return null;
    },
  },
  {
    name: 'AUDIT_LOG_GAP',
    severity: 'critical',
    async check(_ctx, db) {
      const rows = await db.query(
        `SELECT sequence_number FROM hipaa_audit_logs ORDER BY sequence_number DESC LIMIT 1000`,
        [],
      );
      if (!rows.length) return null;
      const nums: number[] = rows
        .map((r: any) => Number(r.sequence_number))
        .filter((n: number) => !isNaN(n))
        .sort((a: number, b: number) => a - b);
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] - nums[i - 1] > 1) {
          return {
            rule: 'AUDIT_LOG_GAP',
            severity: 'critical',
            details: { gap_start: nums[i - 1], gap_end: nums[i], gap_size: nums[i] - nums[i - 1] - 1 },
          };
        }
      }
      return null;
    },
  },
  {
    name: 'BULK_EXPORT_UNAUTHORISED',
    severity: 'high',
    async check(ctx, _db) {
      if (ctx.action === 'data_export' && !ctx.resource.includes('research-day')) {
        return {
          rule: 'BULK_EXPORT_UNAUTHORISED',
          severity: 'high',
          details: { action: ctx.action, resource: ctx.resource },
        };
      }
      return null;
    },
  },
];

@Injectable()
export class BreachDetectionService {
  private readonly logger = new Logger(BreachDetectionService.name);

  async evaluateAuditEvent(ctx: RuleContext, db: any): Promise<void> {
    for (const rule of ANOMALY_RULES) {
      try {
        const result = await rule.check(ctx, db);
        if (result) {
          await this.recordAnomaly(ctx, result, db);
          if (result.severity === 'critical' || result.severity === 'high') {
            this.alertAsync(ctx, result);
          }
        }
      } catch (err: any) {
        this.logger.error(`Rule ${rule.name} failed: ${err.message}`);
      }
    }
  }

  private alertAsync(ctx: RuleContext, result: AnomalyResult): void {
    Promise.resolve().then(() => {
      this.logger.warn(
        `SECURITY ALERT [${result.severity.toUpperCase()}] ${result.rule} — user=${ctx.userEmail} ip=${ctx.ipAddress} details=${JSON.stringify(result.details)}`,
      );
    }).catch(() => undefined);
  }

  private async recordAnomaly(ctx: RuleContext, result: AnomalyResult, db: any): Promise<void> {
    await db.query(
      `INSERT INTO anomaly_events (user_id, user_email, rule_name, severity, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [ctx.userId || null, ctx.userEmail || null, result.rule, result.severity, JSON.stringify(result.details), ctx.ipAddress || null],
    );
  }

  async getOpenAnomalies(db: any, page = 1, limit = 50): Promise<any[]> {
    const offset = (page - 1) * limit;
    return db.query(
      `SELECT * FROM anomaly_events WHERE acknowledged_at IS NULL AND is_false_positive = false
       ORDER BY detected_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  async acknowledgeAnomaly(
    anomalyId: string,
    acknowledgedBy: string,
    isFalsePositive: boolean,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE anomaly_events SET acknowledged_at = NOW(), acknowledged_by = $2, is_false_positive = $3 WHERE id = $1`,
      [anomalyId, acknowledgedBy, isFalsePositive],
    );
  }

  async verifyAuditChain(db: any): Promise<{ valid: boolean; firstBrokenAt?: number }> {
    const rows = await db.query(
      `SELECT id, sequence_number, chain_hash FROM hipaa_audit_logs
       WHERE chain_hash IS NOT NULL ORDER BY sequence_number ASC LIMIT 10000`,
      [],
    );

    let previousHash = '0'.repeat(64);
    for (const row of rows) {
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${previousHash}|${row.id}|${row.sequence_number}`)
        .digest('hex');
      if (row.chain_hash && row.chain_hash !== expectedHash) {
        return { valid: false, firstBrokenAt: Number(row.sequence_number) };
      }
      previousHash = row.chain_hash ?? expectedHash;
    }

    return { valid: true };
  }

  async getAnomalyStats(db: any): Promise<{ total: number; critical: number; high: number; unacknowledged: number }> {
    const rows = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
         COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
         COUNT(*) FILTER (WHERE acknowledged_at IS NULL AND is_false_positive = false)::int AS unacknowledged
       FROM anomaly_events`,
      [],
    );
    return rows[0] ?? { total: 0, critical: 0, high: 0, unacknowledged: 0 };
  }
}
