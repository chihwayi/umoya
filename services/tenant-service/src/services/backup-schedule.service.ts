import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BackupService } from './backup.service';

type ScheduleRow = {
  scope_key: string;
  enabled: boolean;
  frequency: 'daily';
  run_time: string;
  timezone: string;
  retention_days: number;
  last_run_at: Date | null;
  last_run_status: 'never' | 'success' | 'failed';
  last_error: string | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export interface BackupScheduleView {
  enabled: boolean;
  frequency: 'daily';
  runTime: string;
  timezone: string;
  retentionDays: number;
  lastRunAt: string | null;
  lastRunStatus: 'never' | 'success' | 'failed';
  lastError: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBackupScheduleInput {
  enabled?: boolean;
  runTime?: string;
  timezone?: string;
  retentionDays?: number;
}

@Injectable()
export class BackupScheduleService implements OnModuleInit {
  private readonly logger = new Logger(BackupScheduleService.name);
  private readonly scopeKey = 'global';
  private isCronRunning = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly backupService: BackupService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  async getSchedule(): Promise<BackupScheduleView> {
    await this.ensureInitialized();
    const row = await this.getScheduleRow();
    return this.toView(row);
  }

  async updateSchedule(input: UpdateBackupScheduleInput, updatedBy?: string): Promise<BackupScheduleView> {
    await this.ensureInitialized();
    const current = await this.getScheduleRow();

    const enabled = input.enabled === undefined ? current.enabled : Boolean(input.enabled);
    const runTime = input.runTime === undefined ? current.run_time : String(input.runTime || '').trim();
    const timezone = input.timezone === undefined ? current.timezone : String(input.timezone || '').trim();
    const retentionDays =
      input.retentionDays === undefined ? current.retention_days : Number(input.retentionDays);

    this.assertValidRunTime(runTime);
    await this.assertValidTimeZone(timezone);

    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      throw new BadRequestException('retentionDays must be between 1 and 3650');
    }

    const nextRunAt = enabled ? await this.calculateNextRunAt(runTime, timezone) : null;

    await this.dataSource.query(
      `
      UPDATE backup_schedules
      SET
        enabled = $2,
        frequency = 'daily',
        run_time = $3,
        timezone = $4,
        retention_days = $5,
        next_run_at = $6,
        updated_by = $7,
        updated_at = NOW()
      WHERE scope_key = $1
      RETURNING *
      `,
      [this.scopeKey, enabled, runTime, timezone, retentionDays, nextRunAt, updatedBy || null],
    );

    const fresh = await this.getScheduleRow();
    return this.toView(fresh);
  }

  async runScheduledBackupNow(updatedBy?: string): Promise<{
    message: string;
    backupId: string;
    nextRunAt: string | null;
  }> {
    await this.ensureInitialized();
    const row = await this.getScheduleRow();

    const backup = await this.backupService.createBackup('auto');
    let prunedCount = 0;
    if (row.retention_days > 0) {
      prunedCount = await this.backupService.pruneBackupsOlderThan(row.retention_days);
    }

    const nextRunAt = row.enabled ? await this.calculateNextRunAt(row.run_time, row.timezone) : null;
    await this.dataSource.query(
      `
      UPDATE backup_schedules
      SET
        last_run_at = NOW(),
        last_run_status = 'success',
        last_error = NULL,
        next_run_at = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE scope_key = $1
      `,
      [this.scopeKey, nextRunAt, updatedBy || null],
    );

    return {
      message:
        prunedCount > 0
          ? `Auto backup completed. Pruned ${prunedCount} expired backup(s).`
          : 'Auto backup completed.',
      backupId: backup.id,
      nextRunAt: nextRunAt ? new Date(nextRunAt).toISOString() : null,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledBackups(): Promise<void> {
    if (this.isCronRunning) {
      return;
    }

    this.isCronRunning = true;
    try {
      await this.ensureInitialized();
      const dueRows = (await this.dataSource.query(
        `
        SELECT *
        FROM backup_schedules
        WHERE scope_key = $1
          AND enabled = TRUE
          AND next_run_at IS NOT NULL
          AND next_run_at <= NOW()
        `,
        [this.scopeKey],
      )) as ScheduleRow[];

      if (dueRows.length === 0) {
        return;
      }

      for (const row of dueRows) {
        await this.executeScheduledRun(row);
      }
    } catch (error: any) {
      this.logger.error(`Scheduled backup cycle failed: ${error?.message || error}`);
    } finally {
      this.isCronRunning = false;
    }
  }

  private async executeScheduledRun(row: ScheduleRow): Promise<void> {
    try {
      this.logger.log(`Executing scheduled backup for scope '${row.scope_key}'`);
      await this.backupService.createBackup('auto');

      if (row.retention_days > 0) {
        await this.backupService.pruneBackupsOlderThan(row.retention_days);
      }

      const nextRunAt = await this.calculateNextRunAt(row.run_time, row.timezone);
      await this.dataSource.query(
        `
        UPDATE backup_schedules
        SET
          last_run_at = NOW(),
          last_run_status = 'success',
          last_error = NULL,
          next_run_at = $2,
          updated_at = NOW()
        WHERE scope_key = $1
        `,
        [row.scope_key, nextRunAt],
      );
      this.logger.log(`Scheduled backup completed for scope '${row.scope_key}'`);
    } catch (error: any) {
      const message = String(error?.message || error || 'Unknown backup error');
      this.logger.error(`Scheduled backup failed for scope '${row.scope_key}': ${message}`);
      const nextRunAt = await this.calculateNextRunAt(row.run_time, row.timezone);
      await this.dataSource.query(
        `
        UPDATE backup_schedules
        SET
          last_run_at = NOW(),
          last_run_status = 'failed',
          last_error = $2,
          next_run_at = $3,
          updated_at = NOW()
        WHERE scope_key = $1
        `,
        [row.scope_key, message.slice(0, 2000), nextRunAt],
      );
    }
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
        CREATE TABLE IF NOT EXISTS backup_schedules (
          scope_key VARCHAR(32) PRIMARY KEY,
          enabled BOOLEAN NOT NULL DEFAULT FALSE,
          frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
          run_time VARCHAR(5) NOT NULL DEFAULT '02:00',
          timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
          retention_days INTEGER NOT NULL DEFAULT 30,
          last_run_at TIMESTAMP WITH TIME ZONE NULL,
          last_run_status VARCHAR(20) NOT NULL DEFAULT 'never',
          last_error TEXT NULL,
          next_run_at TIMESTAMP WITH TIME ZONE NULL,
          updated_by UUID NULL REFERENCES admin_users(id),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT backup_schedules_frequency_check CHECK (frequency IN ('daily')),
          CONSTRAINT backup_schedules_run_time_check CHECK (run_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
          CONSTRAINT backup_schedules_retention_days_check CHECK (retention_days >= 1 AND retention_days <= 3650),
          CONSTRAINT backup_schedules_last_run_status_check CHECK (last_run_status IN ('never', 'success', 'failed'))
        )
      `);

      await this.dataSource.query(
        `
        INSERT INTO backup_schedules (
          scope_key,
          enabled,
          frequency,
          run_time,
          timezone,
          retention_days
        )
        VALUES ($1, FALSE, 'daily', '02:00', 'UTC', 30)
        ON CONFLICT (scope_key) DO NOTHING
        `,
        [this.scopeKey],
      );

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run_at
        ON backup_schedules(next_run_at)
      `);

      const row = await this.getScheduleRow();
      if (row.enabled && !row.next_run_at) {
        const nextRunAt = await this.calculateNextRunAt(row.run_time, row.timezone);
        await this.dataSource.query(
          `
          UPDATE backup_schedules
          SET next_run_at = $2, updated_at = NOW()
          WHERE scope_key = $1
          `,
          [this.scopeKey, nextRunAt],
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to initialize backup schedule: ${error?.message || error}`);
      throw new InternalServerErrorException('Could not initialize backup scheduler');
    }
  }

  private async getScheduleRow(): Promise<ScheduleRow> {
    const rows = (await this.dataSource.query(
      `
      SELECT *
      FROM backup_schedules
      WHERE scope_key = $1
      LIMIT 1
      `,
      [this.scopeKey],
    )) as ScheduleRow[];

    if (!rows[0]) {
      throw new InternalServerErrorException('Backup schedule row missing');
    }
    return rows[0];
  }

  private assertValidRunTime(value: string): void {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException('runTime must be in HH:mm format');
    }
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new BadRequestException('runTime must be a valid 24-hour time');
    }
  }

  private async assertValidTimeZone(timezone: string): Promise<void> {
    if (!timezone || timezone.length < 2 || timezone.length > 64) {
      throw new BadRequestException('timezone is required');
    }
    try {
      await this.dataSource.query(`SELECT NOW() AT TIME ZONE $1`, [timezone]);
    } catch {
      throw new BadRequestException(`Unsupported timezone: ${timezone}`);
    }
  }

  private async calculateNextRunAt(runTime: string, timezone: string, reference?: Date): Promise<string> {
    const base = reference || new Date();
    const rows = await this.dataSource.query(
      `
      SELECT
        CASE
          WHEN ((date_trunc('day', $3::timestamptz AT TIME ZONE $1) + $2::time) AT TIME ZONE $1) > $3::timestamptz
            THEN ((date_trunc('day', $3::timestamptz AT TIME ZONE $1) + $2::time) AT TIME ZONE $1)
          ELSE ((date_trunc('day', $3::timestamptz AT TIME ZONE $1) + INTERVAL '1 day' + $2::time) AT TIME ZONE $1)
        END AS next_run_at
      `,
      [timezone, runTime, base.toISOString()],
    );

    const nextRunAt = rows?.[0]?.next_run_at;
    if (!nextRunAt) {
      throw new InternalServerErrorException('Could not compute next backup run time');
    }
    return new Date(nextRunAt).toISOString();
  }

  private toView(row: ScheduleRow): BackupScheduleView {
    return {
      enabled: Boolean(row.enabled),
      frequency: 'daily',
      runTime: String(row.run_time),
      timezone: String(row.timezone),
      retentionDays: Number(row.retention_days || 30),
      lastRunAt: this.toIsoOrNull(row.last_run_at),
      lastRunStatus: row.last_run_status || 'never',
      lastError: row.last_error || null,
      nextRunAt: this.toIsoOrNull(row.next_run_at),
      createdAt: this.toIsoOrNull(row.created_at) || new Date().toISOString(),
      updatedAt: this.toIsoOrNull(row.updated_at) || new Date().toISOString(),
    };
  }

  private toIsoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    // Normalize PostgreSQL raw timestamp strings:
    // "2026-03-12 13:02:08.556147+00" -> "2026-03-12T13:02:08.556Z"
    const normalized = raw
      .replace(' ', 'T')
      .replace(/(\.\d{3})\d+/, '$1')
      .replace(/\+00$/, 'Z')
      .replace(/\+0000$/, 'Z')
      .replace(/\+00:00$/, 'Z');

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }
}
