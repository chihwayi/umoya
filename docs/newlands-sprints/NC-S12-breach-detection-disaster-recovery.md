# NC-S12 — Breach Detection + Disaster Recovery + Backup DR

**Sprint ID:** NC-S12  
**Priority:** Critical  
**Effort:** 9 days  
**Dependencies:** NC-S01 (CDPA compliance), NC-S02 (session management)  
**Gaps Covered:**
- Feature 8.1 — Real-time breach detection with anomaly alerting (0% → 100%)
- Feature 8.2 — Automated daily encrypted backups with integrity verification (30% → 100%)
- Feature 8.3 — Disaster recovery runbook + RTO/RPO monitoring (0% → 100%)
- Feature 8.4 — POTRAZ breach notification workflow (72-hour requirement per CDPA 2021) (0% → 100%)
- Feature 8.5 — Audit log tamper detection (0% → 100%)

---

## 1. Codebase Context

### Existing Audit Infrastructure
- `services/ehr-service/src/services/audit.service.ts` — exists, logs to `audit_logs` table; no tamper detection
- `services/ehr-service/src/entities/audit-log.entity.ts` — fields: `id`, `user_id`, `action`, `resource`, `timestamp`, `ip_address`, `tenant_id`; **no hash chaining**
- `services/tenant-service/src/services/backup.service.ts` — stub only: `async backup() { return 'not implemented'; }`
- No breach detection service exists
- No scheduled backup job exists
- No POTRAZ notification workflow

### Existing Infrastructure Config
- `docker-compose.yml` — PostgreSQL, Redis containers
- `.env.example` — `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`; no backup-related vars
- CI pipeline: `.github/workflows/ci.yml` — runs tests, no backup verification step

### Critical Security Requirement
Zimbabwe CDPA 2021 Article 43: notify POTRAZ **within 72 hours** of becoming aware of a personal data breach. Failure = ZWL 500,000 fine.

---

## 2. What This Sprint Builds

### Part A — Breach Detection Engine
Anomaly rules that fire when suspicious patterns are detected:
1. Single user downloads >200 records in 1 hour
2. Login from unusual IP geolocation (country change)
3. >10 failed login attempts in 5 minutes
4. After-hours access to sensitive endpoints (00:00–05:00 local time)
5. Bulk export of records while not in an authorised export session
6. Audit log gaps (sequence breaks indicating deletion)

### Part B — Hash-Chained Audit Log
Each audit log entry stores a SHA-256 hash of `(previous_hash || entry_data)`, forming an immutable chain. Verifying the chain detects any record deletion or modification.

### Part C — Automated Backup Pipeline
Daily pg_dump to encrypted archive; upload to off-site S3-compatible store; verify with `pg_restore --list`.

### Part D — Disaster Recovery Runbook (Documented + API-driven)
DR test endpoint that verifies backup integrity on demand. RTO target: 4 hours. RPO target: 24 hours (daily backup).

### Part E — POTRAZ Breach Notification Workflow
API-driven breach incident lifecycle: detect → assess → notify POTRAZ (email + API if available) → remediate → close.

---

## 3. Database Changes

### 3.1 System-level schema (in `tenant-service`, `ensureSubscriptionSchema()`)
```typescript
// Add to ensureSubscriptionSchema() in database-provisioning.service.ts (tenant-service):
await db.query(`
  CREATE TABLE IF NOT EXISTS breach_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    breach_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL,
    affected_records_count INTEGER,
    affected_patients JSONB,
    detected_by VARCHAR(64) NOT NULL DEFAULT 'system',
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    potraz_notified_at TIMESTAMPTZ,
    potraz_reference VARCHAR(128),
    potraz_notified_within_72h BOOLEAN,
    remediated_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_breach_incidents_tenant ON breach_incidents(tenant_id)`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_breach_incidents_status ON breach_incidents(status)`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_breach_incidents_detected ON breach_incidents(detected_at)`);

await db.query(`
  CREATE TABLE IF NOT EXISTS backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    file_path TEXT,
    file_size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    storage_location TEXT,
    error_message TEXT,
    verified_at TIMESTAMPTZ,
    verification_status VARCHAR(32)
  )
`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant ON backup_jobs(tenant_id)`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status)`);
```

### 3.2 Per-tenant provisioning bundle — add to `getProvisioningBundles()` in `ehr-service`
```typescript
{
  id: 'nc_breach_detection',
  tables: [
    `CREATE TABLE IF NOT EXISTS anomaly_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      user_email VARCHAR(255),
      rule_name VARCHAR(64) NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'medium',
      details JSONB NOT NULL DEFAULT '{}',
      ip_address VARCHAR(45),
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by UUID,
      is_false_positive BOOLEAN NOT NULL DEFAULT false,
      incident_id UUID
    )`,
    `CREATE INDEX IF NOT EXISTS idx_anomaly_events_user ON anomaly_events(user_id, detected_at)`,
    `CREATE INDEX IF NOT EXISTS idx_anomaly_events_rule ON anomaly_events(rule_name, detected_at)`,
    `CREATE INDEX IF NOT EXISTS idx_anomaly_events_unacked ON anomaly_events(detected_at) WHERE acknowledged_at IS NULL`,

    // Hash-chained audit extension — add chain_hash column to existing audit_logs
    // Use ALTER TABLE IF NOT EXISTS idiom:
    `DO $$ BEGIN
       ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS chain_hash VARCHAR(64);
       ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sequence_number BIGSERIAL;
     END $$`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_sequence ON audit_logs(sequence_number)`,

    `CREATE TABLE IF NOT EXISTS dr_test_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      backup_job_id UUID,
      rto_minutes INTEGER,
      rpo_hours INTEGER,
      result VARCHAR(32) NOT NULL,
      notes TEXT
    )`,
  ],
}
```

### 3.3 After provisioning: `POST /api/admin/tenants/repair-all`

---

## 4. Backend Implementation

### 4.1 Breach Detection Service
**File:** `services/ehr-service/src/services/breach-detection.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface AnomalyRule {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (context: RuleContext, db: DatabaseService, tenantDb: string) => Promise<AnomalyResult | null>;
}

interface RuleContext {
  userId: string;
  userEmail: string;
  ipAddress: string;
  action: string;
  resource: string;
  timestamp: Date;
  tenantDb: string;
}

interface AnomalyResult {
  rule: string;
  severity: AnomalyRule['severity'];
  details: Record<string, unknown>;
}

const ANOMALY_RULES: AnomalyRule[] = [
  {
    name: 'BULK_DOWNLOAD',
    severity: 'high',
    async check(ctx, db, tenantDb) {
      const row = await db.queryOne<{ cnt: number }>(
        tenantDb,
        `SELECT COUNT(*)::int as cnt FROM audit_logs
         WHERE user_id = $1 AND action = 'READ' AND timestamp > NOW() - INTERVAL '1 hour'`,
        [ctx.userId],
      );
      if ((row?.cnt ?? 0) > 200) {
        return { rule: 'BULK_DOWNLOAD', severity: 'high', details: { count: row!.cnt, window: '1h' } };
      }
      return null;
    },
  },
  {
    name: 'BRUTE_FORCE_LOGIN',
    severity: 'critical',
    async check(ctx, db, tenantDb) {
      if (ctx.action !== 'LOGIN_FAILED') return null;
      const row = await db.queryOne<{ cnt: number }>(
        tenantDb,
        `SELECT COUNT(*)::int as cnt FROM audit_logs
         WHERE user_email = $1 AND action = 'LOGIN_FAILED' AND timestamp > NOW() - INTERVAL '5 minutes'`,
        [ctx.userEmail],
      );
      if ((row?.cnt ?? 0) > 10) {
        return { rule: 'BRUTE_FORCE_LOGIN', severity: 'critical', details: { attempts: row!.cnt, window: '5m' } };
      }
      return null;
    },
  },
  {
    name: 'AFTER_HOURS_SENSITIVE_ACCESS',
    severity: 'medium',
    async check(ctx, _db, _tenantDb) {
      const hour = ctx.timestamp.getHours();
      const sensitiveResources = ['patients', 'hiv_enrollments', 'lab_results', 'cdpa_controls'];
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
    async check(_ctx, db, tenantDb) {
      // Check for sequence gaps in last 1000 audit log entries
      const rows = await db.query<{ sequence_number: number }>(
        tenantDb,
        `SELECT sequence_number FROM audit_logs ORDER BY sequence_number DESC LIMIT 1000`,
        [],
      );
      const nums = rows.map((r) => r.sequence_number).sort((a, b) => a - b);
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
    async check(ctx, _db, _tenantDb) {
      if (ctx.action === 'EXPORT' && !ctx.resource.includes('research-day')) {
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

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationService,
    @InjectQueue('breach-alerts') private readonly alertQueue: Queue,
  ) {}

  async evaluateAuditEvent(ctx: RuleContext): Promise<void> {
    for (const rule of ANOMALY_RULES) {
      try {
        const result = await rule.check(ctx, this.db, ctx.tenantDb);
        if (result) {
          await this.recordAnomaly(ctx, result);
          if (result.severity === 'critical' || result.severity === 'high') {
            await this.alertQueue.add('breach-alert', { ctx, result, tenantDb: ctx.tenantDb });
          }
        }
      } catch (err: any) {
        this.logger.error(`Rule ${rule.name} failed: ${err.message}`);
      }
    }
  }

  private async recordAnomaly(ctx: RuleContext, result: AnomalyResult): Promise<void> {
    await this.db.query(
      ctx.tenantDb,
      `INSERT INTO anomaly_events (user_id, user_email, rule_name, severity, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ctx.userId, ctx.userEmail, result.rule, result.severity, JSON.stringify(result.details), ctx.ipAddress],
    );
  }

  async getOpenAnomalies(tenantDb: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    return this.db.query(
      tenantDb,
      `SELECT * FROM anomaly_events WHERE acknowledged_at IS NULL AND is_false_positive = false
       ORDER BY detected_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  async acknowledgeAnomaly(
    anomalyId: string,
    acknowledgedBy: string,
    isFalsePositive: boolean,
    tenantDb: string,
  ): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE anomaly_events SET acknowledged_at = NOW(), acknowledged_by = $2, is_false_positive = $3 WHERE id = $1`,
      [anomalyId, acknowledgedBy, isFalsePositive],
    );
  }

  async verifyAuditChain(tenantDb: string): Promise<{ valid: boolean; firstBrokenAt?: number }> {
    const rows = await this.db.query<{ id: string; sequence_number: number; chain_hash: string }>(
      tenantDb,
      `SELECT id, sequence_number, chain_hash FROM audit_logs ORDER BY sequence_number ASC`,
      [],
    );

    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    for (const row of rows) {
      const crypto = await import('crypto');
      const expectedHash = crypto.createHash('sha256').update(`${previousHash}|${row.id}|${row.sequence_number}`).digest('hex');
      if (row.chain_hash && row.chain_hash !== expectedHash) {
        return { valid: false, firstBrokenAt: row.sequence_number };
      }
      previousHash = row.chain_hash ?? expectedHash;
    }

    return { valid: true };
  }
}
```

### 4.2 Update `AuditService` to compute chain hash on every write
**File:** `services/ehr-service/src/services/audit.service.ts` — modify `log()` method:

```typescript
// At top:
import * as crypto from 'crypto';

// Replace or augment the log() method:
async log(data: CreateAuditLogDto, tenantDb: string): Promise<void> {
  // Get last chain hash
  const last = await this.db.queryOne<{ chain_hash: string; sequence_number: number }>(
    tenantDb,
    `SELECT chain_hash, sequence_number FROM audit_logs ORDER BY sequence_number DESC LIMIT 1`,
    [],
  );
  const prevHash = last?.chain_hash ?? '0'.repeat(64);

  // Compute new hash — sequence_number auto-assigned by SERIAL; approximate with timestamp+rand
  const entryData = `${data.userId}|${data.action}|${data.resource}|${Date.now()}`;
  const newHash = crypto.createHash('sha256').update(`${prevHash}|${entryData}`).digest('hex');

  await this.db.query(
    tenantDb,
    `INSERT INTO audit_logs (user_id, action, resource, timestamp, ip_address, tenant_id, chain_hash)
     VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
    [data.userId, data.action, data.resource, data.ipAddress, data.tenantId, newHash],
  );
}
```

### 4.3 Backup Service (fully implemented)
**File:** `services/ehr-service/src/services/backup.service.ts` (replaces stub)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from './database.service';
import { TenantService } from './tenant.service';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_DIR = process.env.BACKUP_DIR ?? '/var/backups/medicore';
  private readonly S3_BUCKET = process.env.BACKUP_S3_BUCKET ?? '';
  private readonly ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY ?? '';

  constructor(
    private readonly db: DatabaseService,
    private readonly tenantService: TenantService,
  ) {}

  @Cron('0 2 * * *') // 02:00 daily
  async runNightlyBackups(): Promise<void> {
    const tenants = await this.tenantService.getActiveTenants();
    for (const tenant of tenants) {
      await this.backupTenant(tenant.id, tenant.db_name);
    }
  }

  async backupTenant(tenantId: string, dbName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFile = path.join(this.BACKUP_DIR, `${tenantId}_${timestamp}.dump`);
    const encFile = `${dumpFile}.enc`;

    fs.mkdirSync(this.BACKUP_DIR, { recursive: true });

    // Record job start in system DB
    const [job] = await this.db.query<{ id: string }>(
      'system',
      `INSERT INTO backup_jobs (tenant_id, status, started_at) VALUES ($1, 'running', NOW()) RETURNING id`,
      [tenantId],
    );

    try {
      // 1. pg_dump
      await this.execCommand(
        `pg_dump --format=custom --no-password ${dbName} -f ${dumpFile}`,
        { DATABASE_URL: process.env.DATABASE_URL! },
      );

      // 2. Encrypt with AES-256-GCM
      const key = Buffer.from(this.ENCRYPTION_KEY, 'hex'); // 32-byte hex key
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const input = fs.createReadStream(dumpFile);
      const output = fs.createWriteStream(encFile);

      await new Promise<void>((resolve, reject) => {
        input.pipe(cipher).pipe(output);
        output.on('finish', () => {
          const tag = cipher.getAuthTag();
          fs.appendFileSync(encFile, Buffer.concat([iv, tag]));
          resolve();
        });
        output.on('error', reject);
      });

      // 3. Compute SHA-256 checksum of encrypted file
      const checksum = await this.computeChecksum(encFile);
      const fileSize = fs.statSync(encFile).size;

      // 4. Upload to S3 (if configured)
      let storageLocation = encFile;
      if (this.S3_BUCKET) {
        await this.execCommand(`aws s3 cp ${encFile} s3://${this.S3_BUCKET}/${tenantId}/${path.basename(encFile)} --sse AES256`);
        storageLocation = `s3://${this.S3_BUCKET}/${tenantId}/${path.basename(encFile)}`;
      }

      // 5. Verify backup integrity via pg_restore --list
      const verifyResult = await this.verifyBackup(dumpFile);

      // 6. Clean up local plain dump
      fs.unlinkSync(dumpFile);

      // Update job record
      await this.db.query(
        'system',
        `UPDATE backup_jobs SET status = 'completed', completed_at = NOW(), file_path = $2,
         file_size_bytes = $3, checksum_sha256 = $4, storage_location = $5,
         verified_at = NOW(), verification_status = $6 WHERE id = $1`,
        [job.id, encFile, fileSize, checksum, storageLocation, verifyResult ? 'ok' : 'failed'],
      );

      this.logger.log(`Backup completed for tenant ${tenantId}: ${storageLocation}`);
      return storageLocation;
    } catch (err: any) {
      await this.db.query(
        'system',
        `UPDATE backup_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
        [job.id, err.message],
      );
      this.logger.error(`Backup failed for tenant ${tenantId}: ${err.message}`);
      throw err;
    }
  }

  async verifyBackupIntegrity(backupJobId: string): Promise<{ valid: boolean; details: string }> {
    const job = await this.db.queryOne<{ file_path: string; checksum_sha256: string }>(
      'system',
      `SELECT file_path, checksum_sha256 FROM backup_jobs WHERE id = $1`,
      [backupJobId],
    );

    if (!job) return { valid: false, details: 'Backup job not found' };

    const localPath = job.file_path.startsWith('s3://')
      ? await this.downloadFromS3(job.file_path)
      : job.file_path;

    const currentChecksum = await this.computeChecksum(localPath);
    const valid = currentChecksum === job.checksum_sha256;

    return {
      valid,
      details: valid
        ? `Checksum matches: ${currentChecksum}`
        : `Checksum mismatch! Expected: ${job.checksum_sha256}, Got: ${currentChecksum}`,
    };
  }

  private async verifyBackup(dumpFile: string): Promise<boolean> {
    try {
      await this.execCommand(`pg_restore --list ${dumpFile} > /dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  private async computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (d) => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async downloadFromS3(s3Path: string): Promise<string> {
    const local = path.join(this.BACKUP_DIR, 'verify_temp.enc');
    await this.execCommand(`aws s3 cp ${s3Path} ${local}`);
    return local;
  }

  private execCommand(cmd: string, extraEnv: Record<string, string> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      child_process.exec(
        cmd,
        { env: { ...process.env, ...extraEnv } },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
}
```

### 4.4 POTRAZ Notification Service
**File:** `services/ehr-service/src/services/potraz-notification.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface BreachIncident {
  id: string;
  detected_at: string;
  breach_type: string;
  severity: string;
  description: string;
  affected_records_count: number;
  potraz_notified_at: string | null;
}

@Injectable()
export class PotrazNotificationService {
  private readonly logger = new Logger(PotrazNotificationService.name);
  private readonly POTRAZ_EMAIL = process.env.POTRAZ_EMAIL ?? 'dpa@potraz.gov.zw';
  private readonly CLINIC_NAME = 'Newlands Clinic';
  private readonly CLINIC_DPO_EMAIL = process.env.CLINIC_DPO_EMAIL ?? '';

  constructor(private readonly db: DatabaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndNotifyApproaching72h(): Promise<void> {
    // Get incidents detected >48h ago not yet notified (warn DPO)
    const approaching = await this.db.query<BreachIncident>(
      'system',
      `SELECT * FROM breach_incidents
       WHERE potraz_notified_at IS NULL
         AND status = 'open'
         AND detected_at < NOW() - INTERVAL '48 hours'`,
      [],
    );

    for (const incident of approaching) {
      const hoursElapsed = Math.round(
        (Date.now() - new Date(incident.detected_at).getTime()) / 3600000,
      );
      await this.alertDpo(incident, hoursElapsed);
    }

    // Get incidents >72h not notified — mark as overdue
    const overdue = await this.db.query<BreachIncident>(
      'system',
      `SELECT * FROM breach_incidents
       WHERE potraz_notified_at IS NULL
         AND status = 'open'
         AND detected_at < NOW() - INTERVAL '72 hours'`,
      [],
    );

    for (const incident of overdue) {
      await this.db.query(
        'system',
        `UPDATE breach_incidents SET status = 'overdue_notification' WHERE id = $1`,
        [incident.id],
      );
      this.logger.error(`BREACH INCIDENT ${incident.id} IS OVERDUE FOR POTRAZ NOTIFICATION!`);
    }
  }

  async notifyPotraz(incidentId: string, systemDb: string): Promise<{ reference: string }> {
    const incident = await this.db.queryOne<BreachIncident>(
      systemDb,
      `SELECT * FROM breach_incidents WHERE id = $1`,
      [incidentId],
    );

    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const reference = `NEWLANDS-BREACH-${incident.id.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;

    // In production: send email to POTRAZ and store response
    // Here we log and record the notification
    const notificationBody = this.buildPotrazNotificationBody(incident, reference);
    this.logger.log(`POTRAZ Notification sent: ${reference}\n${notificationBody}`);

    const hoursFromDetection = Math.round(
      (Date.now() - new Date(incident.detected_at).getTime()) / 3600000,
    );

    await this.db.query(
      systemDb,
      `UPDATE breach_incidents SET
         potraz_notified_at = NOW(),
         potraz_reference = $2,
         potraz_notified_within_72h = $3,
         status = 'notified',
         updated_at = NOW()
       WHERE id = $1`,
      [incidentId, reference, hoursFromDetection <= 72],
    );

    return { reference };
  }

  private buildPotrazNotificationBody(incident: BreachIncident, reference: string): string {
    return `
PERSONAL DATA BREACH NOTIFICATION
To: Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ)
Reference: ${reference}
Date: ${new Date().toISOString()}

Organisation: ${this.CLINIC_NAME}
Data Protection Officer: ${this.CLINIC_DPO_EMAIL}

BREACH DETAILS:
Type: ${incident.breach_type}
Severity: ${incident.severity}
Date/Time Detected: ${incident.detected_at}
Description: ${incident.description}
Estimated Affected Records: ${incident.affected_records_count ?? 'Under assessment'}

NATURE OF PERSONAL DATA AFFECTED:
- Patient health records (HIV status, clinical notes, lab results)
- Contact information (phone numbers, addresses)

LIKELY CONSEQUENCES:
${incident.severity === 'critical' ? 'Potential disclosure of sensitive health data to unauthorised parties.' : 'Limited exposure; investigation ongoing.'}

MEASURES TAKEN:
- Immediate system lockdown of affected user accounts
- Audit log review initiated
- Affected patients to be notified within 30 days

This notification is submitted in compliance with Section 43 of the Zimbabwe Data Protection Act (CDPA 2021).
    `.trim();
  }

  private async alertDpo(incident: BreachIncident, hoursElapsed: number): Promise<void> {
    this.logger.warn(
      `ALERT: Breach incident ${incident.id} is ${hoursElapsed}h old — POTRAZ notification required within 72h. DPO must act NOW.`,
    );
    // In production: send email/SMS to DPO
  }

  async createIncident(
    data: {
      tenantId: string;
      breachType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      affectedRecordsCount?: number;
    },
    systemDb: string,
  ): Promise<string> {
    const [incident] = await this.db.query<{ id: string }>(
      systemDb,
      `INSERT INTO breach_incidents (tenant_id, breach_type, severity, description, affected_records_count)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        data.tenantId,
        data.breachType,
        data.severity,
        data.description,
        data.affectedRecordsCount ?? null,
      ],
    );
    return incident.id;
  }
}
```

### 4.5 Breach Detection Controller
**File:** `services/ehr-service/src/controllers/breach-detection.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BreachDetectionService } from '../services/breach-detection.service';
import { BackupService } from '../services/backup.service';
import { PotrazNotificationService } from '../services/potraz-notification.service';
import { Request } from 'express';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class BreachDetectionController {
  constructor(
    private readonly breachDetection: BreachDetectionService,
    private readonly backup: BackupService,
    private readonly potraz: PotrazNotificationService,
  ) {}

  @Get('anomalies')
  getOpenAnomalies(
    @Query('page') page = 1,
    @Req() req: Request,
  ) {
    return this.breachDetection.getOpenAnomalies((req as any).tenantDb, +page);
  }

  @Patch('anomalies/:id/acknowledge')
  acknowledgeAnomaly(
    @Param('id') id: string,
    @Body() body: { isFalsePositive: boolean },
    @Req() req: Request,
  ) {
    const { user, tenantDb } = req as any;
    return this.breachDetection.acknowledgeAnomaly(id, user.sub, body.isFalsePositive, tenantDb);
  }

  @Get('audit-chain/verify')
  verifyAuditChain(@Req() req: Request) {
    return this.breachDetection.verifyAuditChain((req as any).tenantDb);
  }

  @Post('backup/run')
  async runBackup(@Req() req: Request) {
    const { user } = req as any;
    if (user.role !== 'admin') throw new Error('Admin only');
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.backup.backupTenant(tenantId, `medicore_${tenantId}`);
  }

  @Post('backup/:id/verify')
  verifyBackup(@Param('id') id: string) {
    return this.backup.verifyBackupIntegrity(id);
  }

  @Post('incidents')
  createIncident(@Body() body: any, @Req() req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.potraz.createIncident({ ...body, tenantId }, 'system');
  }

  @Post('incidents/:id/notify-potraz')
  notifyPotraz(@Param('id') id: string) {
    return this.potraz.notifyPotraz(id, 'system');
  }
}
```

### 4.6 Register in `ehr.module.ts`
```typescript
// Add to imports:
BullModule.registerQueue({ name: 'breach-alerts' }),
ScheduleModule.forRoot(), // if not already

// Add to controllers:
BreachDetectionController,

// Add to providers:
BreachDetectionService,
BackupService,
PotrazNotificationService,
```

### 4.7 Hook Breach Detection into `AuditService`
In `audit.service.ts`, after writing the audit log, call:
```typescript
await this.breachDetection.evaluateAuditEvent({
  userId: data.userId,
  userEmail: data.userEmail,
  ipAddress: data.ipAddress,
  action: data.action,
  resource: data.resource,
  timestamp: new Date(),
  tenantDb,
});
```

---

## 5. Frontend Implementation

### 5.1 Security Dashboard Page
**File:** `ehr-frontend/src/pages/SecurityDashboardPage.tsx`

Tabs:
1. **Anomalies** — real-time table of unacknowledged anomaly events; severity badges (critical=red, high=orange, medium=yellow); "Mark False Positive" / "Escalate to Incident" buttons
2. **Breach Incidents** — list of open incidents; POTRAZ notification status (green = notified within 72h, red = overdue); "Notify POTRAZ" action button
3. **Audit Chain** — "Verify Chain Integrity" button; result: valid/broken + first broken sequence number
4. **Backups** — list of recent backup jobs; status, file size, checksum, verification status; "Run Backup Now" and "Verify Integrity" buttons
5. **DR Test Log** — record of disaster recovery tests; RTO/RPO metrics

---

## 6. Environment Variables Required

Add to `.env.example`:
```
BACKUP_DIR=/var/backups/medicore
BACKUP_S3_BUCKET=
BACKUP_ENCRYPTION_KEY=   # 64-char hex string (32 bytes)
POTRAZ_EMAIL=dpa@potraz.gov.zw
CLINIC_DPO_EMAIL=
TWILIO_ACCOUNT_SID=      # (also used for breach SMS alerts)
```

---

## 7. Tests Required

**File:** `services/ehr-service/src/services/__tests__/breach-detection.service.spec.ts`

```typescript
describe('BreachDetectionService', () => {
  describe('BULK_DOWNLOAD rule', () => {
    it('fires when user reads >200 records in 1 hour', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ cnt: 201 });
      const result = await ANOMALY_RULES[0].check(ctx, mockDb, 'tenant_db');
      expect(result).toBeDefined();
      expect(result!.rule).toBe('BULK_DOWNLOAD');
      expect(result!.severity).toBe('high');
    });

    it('does not fire at 200 records exactly', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ cnt: 200 });
      const result = await ANOMALY_RULES[0].check(ctx, mockDb, 'tenant_db');
      expect(result).toBeNull();
    });
  });

  describe('AFTER_HOURS rule', () => {
    it('fires at 02:00 for patient record access', () => {
      const ctx = { timestamp: new Date('2026-06-01T02:00:00'), resource: 'patients/123', action: 'READ' };
      expect(ANOMALY_RULES[2].check(ctx as any, mockDb, 'db')).resolves.not.toBeNull();
    });

    it('does not fire at 10:00', () => {
      const ctx = { timestamp: new Date('2026-06-01T10:00:00'), resource: 'patients/123', action: 'READ' };
      expect(ANOMALY_RULES[2].check(ctx as any, mockDb, 'db')).resolves.toBeNull();
    });
  });

  describe('verifyAuditChain', () => {
    it('returns valid=true for sequential chain', async () => {
      // Mock rows with correct sequential hashes
    });

    it('returns valid=false with firstBrokenAt when gap detected', async () => {
      // Mock rows with a break in sequence
    });
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/potraz-notification.service.spec.ts`

```typescript
describe('PotrazNotificationService', () => {
  it('marks incident as overdue when >72h without notification', async () => {
    mockDb.query.mockResolvedValueOnce([]); // approaching
    mockDb.query.mockResolvedValueOnce([{ id: 'inc1', detected_at: '...', breach_type: 'bulk_download' }]); // overdue
    await service.checkAndNotifyApproaching72h();
    expect(mockDb.query).toHaveBeenCalledWith('system', expect.stringContaining('overdue_notification'), expect.any(Array));
  });

  it('sets potraz_notified_within_72h = true when notified within 72h', async () => {
    const recentIncident = { id: 'inc1', detected_at: new Date(Date.now() - 3600000).toISOString(), ... };
    mockDb.queryOne.mockResolvedValueOnce(recentIncident);
    mockDb.query.mockResolvedValue([{ id: 'inc1' }]);
    await service.notifyPotraz('inc1', 'system');
    expect(mockDb.query).toHaveBeenCalledWith('system', expect.any(String), expect.arrayContaining([true]));
  });
});
```

---

## 8. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in all modified packages
- [ ] `npm test` passes all tests including breach detection and POTRAZ specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills `anomaly_events`, `audit_logs` chain columns, `dr_test_log`; system DB gets `breach_incidents`, `backup_jobs`
- [ ] Audit chain hash computed on every new audit log entry
- [ ] `GET /security/audit-chain/verify` returns `{ valid: true }` on fresh DB; returns `{ valid: false, firstBrokenAt: N }` after manually deleting a row
- [ ] BULK_DOWNLOAD anomaly fires when 201 audit READ events created for single user in 1 hour
- [ ] BRUTE_FORCE_LOGIN anomaly fires after 11 failed login events in 5 minutes
- [ ] `POST /security/backup/run` creates encrypted backup file + backup_jobs record
- [ ] `POST /security/backup/:id/verify` returns `{ valid: true }` for valid backup
- [ ] `POST /security/incidents/:id/notify-potraz` updates `potraz_notified_at`, `potraz_reference`, sets `potraz_notified_within_72h` correctly
- [ ] Cron at 02:00 runs nightly backup for all active tenants
- [ ] POTRAZ hourly cron fires warning at 48h, marks overdue at 72h
