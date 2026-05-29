import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_DIR = process.env.BACKUP_DIR ?? '/var/backups/umoya';
  private readonly S3_BUCKET = process.env.BACKUP_S3_BUCKET ?? '';
  private readonly ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY ?? '';

  constructor(private readonly tenantService: TenantService) {}

  @Cron('0 2 * * *')
  async runNightlyBackups(): Promise<void> {
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        await this.backupTenant(tenant.id, tenant.databaseName);
      } catch (err: any) {
        this.logger.error(`Nightly backup failed for tenant ${tenant.id}: ${err.message}`);
      }
    }
  }

  async backupTenant(tenantId: string, dbName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFile = path.join(this.BACKUP_DIR, `${tenantId}_${timestamp}.dump`);
    const encFile = `${dumpFile}.enc`;

    fs.mkdirSync(this.BACKUP_DIR, { recursive: true });

    const systemDb = this.tenantService.getSystemDb();
    const jobRows = await systemDb.query(
      `INSERT INTO backup_jobs (tenant_id, status, started_at) VALUES ($1, 'running', NOW()) RETURNING id`,
      [tenantId],
    );
    const jobId: string = jobRows[0].id;

    try {
      await this.execCommand(
        `pg_dump --format=custom --no-password -d ${dbName} -f ${dumpFile}`,
      );

      if (this.ENCRYPTION_KEY && this.ENCRYPTION_KEY.length === 64) {
        const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const input = fs.createReadStream(dumpFile);
        const output = fs.createWriteStream(encFile);

        await new Promise<void>((resolve, reject) => {
          input.pipe(cipher).pipe(output);
          output.on('finish', () => {
            const tag = (cipher as any).getAuthTag();
            fs.appendFileSync(encFile, Buffer.concat([iv, tag]));
            resolve();
          });
          output.on('error', reject);
        });

        fs.unlinkSync(dumpFile);
      }

      const finalFile = fs.existsSync(encFile) ? encFile : dumpFile;
      const checksum = await this.computeChecksum(finalFile);
      const fileSize = fs.statSync(finalFile).size;

      let storageLocation = finalFile;
      if (this.S3_BUCKET) {
        await this.execCommand(
          `aws s3 cp ${finalFile} s3://${this.S3_BUCKET}/${tenantId}/${path.basename(finalFile)} --sse AES256`,
        );
        storageLocation = `s3://${this.S3_BUCKET}/${tenantId}/${path.basename(finalFile)}`;
      }

      const verifyOk = await this.verifyDump(fs.existsSync(dumpFile) ? dumpFile : finalFile);

      await systemDb.query(
        `UPDATE backup_jobs SET status = 'completed', completed_at = NOW(),
         file_path = $2, file_size_bytes = $3, checksum_sha256 = $4,
         storage_location = $5, verified_at = NOW(), verification_status = $6
         WHERE id = $1`,
        [jobId, finalFile, fileSize, checksum, storageLocation, verifyOk ? 'ok' : 'failed'],
      );

      this.logger.log(`Backup completed for tenant ${tenantId}: ${storageLocation}`);
      return storageLocation;
    } catch (err: any) {
      await systemDb.query(
        `UPDATE backup_jobs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
        [jobId, err.message],
      );
      this.logger.error(`Backup failed for tenant ${tenantId}: ${err.message}`);
      throw err;
    }
  }

  async listBackupJobs(tenantId: string, limit = 20): Promise<any[]> {
    const systemDb = this.tenantService.getSystemDb();
    return systemDb.query(
      `SELECT * FROM backup_jobs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [tenantId, limit],
    );
  }

  async verifyBackupIntegrity(backupJobId: string): Promise<{ valid: boolean; details: string }> {
    const systemDb = this.tenantService.getSystemDb();
    const rows = await systemDb.query(
      `SELECT file_path, checksum_sha256 FROM backup_jobs WHERE id = $1`,
      [backupJobId],
    );
    if (!rows.length) return { valid: false, details: 'Backup job not found' };

    const { file_path: filePath, checksum_sha256: expected } = rows[0];

    let localPath = filePath as string;
    if (localPath.startsWith('s3://')) {
      localPath = path.join(this.BACKUP_DIR, 'verify_temp.enc');
      await this.execCommand(`aws s3 cp ${filePath} ${localPath}`);
    }

    if (!fs.existsSync(localPath)) {
      return { valid: false, details: `File not found: ${localPath}` };
    }

    const current = await this.computeChecksum(localPath);
    const valid = current === expected;
    return {
      valid,
      details: valid
        ? `Checksum matches: ${current}`
        : `Mismatch — expected: ${expected}, got: ${current}`,
    };
  }

  async recordDrTest(tenantDb: any, backupJobId: string | null, rtoMinutes: number, rpoHours: number, result: string, notes: string): Promise<void> {
    await tenantDb.query(
      `INSERT INTO dr_test_log (backup_job_id, rto_minutes, rpo_hours, result, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [backupJobId, rtoMinutes, rpoHours, result, notes],
    );
  }

  private async verifyDump(dumpFile: string): Promise<boolean> {
    if (!fs.existsSync(dumpFile)) return false;
    try {
      await this.execCommand(`pg_restore --list ${dumpFile} > /dev/null 2>&1`);
      return true;
    } catch {
      return false;
    }
  }

  private computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (d) => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private execCommand(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      child_process.exec(cmd, (err) => (err ? reject(err) : resolve()));
    });
  }
}
