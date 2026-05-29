import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import * as path from 'path';

export interface BackupMetadata {
  id: string;
  name: string;
  date: string;
  size: string;
  sizeBytes: number;
  type: 'auto' | 'manual';
  status: 'success' | 'failed' | 'in_progress';
  key: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('BACKUP_BUCKET_NAME', 'umoya-backups');
    
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_ENDPOINT'); // For MinIO

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || 'minioadmin',
        secretAccessKey: secretAccessKey || 'minioadmin',
      },
      endpoint: endpoint || this.configService.get<string>('MINIO_URL'),
      forcePathStyle: true, // Required for MinIO
    });
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'backups/',
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents
        .filter(item => item.Key?.endsWith('.sql.gz'))
        .map(item => {
          const key = item.Key!;
          const filename = path.basename(key);
          // Expected format: backup-{timestamp}-{id}-{type}.sql.gz
          const parts = filename.replace('.sql.gz', '').split('-');
          const type = parts.includes('manual') ? 'manual' : 'auto';
          
          return {
            id: parts[2] || uuidv4(),
            name: filename,
            date: item.LastModified?.toISOString() || new Date().toISOString(),
            size: this.formatSize(item.Size || 0),
            sizeBytes: item.Size || 0,
            type: type as 'auto' | 'manual',
            status: 'success' as const,
            key: key,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error}`);
      // Return mock data if S3 fails (graceful degradation for demo)
      return [];
    }
  }

  async createBackup(type: 'auto' | 'manual' = 'manual'): Promise<BackupMetadata> {
    const id = uuidv4().substring(0, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}-${id}-${type}.sql.gz`;
    const key = `backups/${filename}`;

    this.logger.log(`Starting backup: ${filename}`);

    // Database connection details
    const dbHost = this.configService.get<string>('DB_HOST', 'localhost');
    const dbPort = this.configService.get<string>('DB_PORT', '5432');
    const dbUser = this.configService.get<string>('DB_USERNAME', 'postgres');
    const dbPass = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const dbName = this.resolveDatabaseName();

    // Prepare pg_dump command
    // PGPASSWORD is set via env to avoid prompt
    const env = { ...process.env, PGPASSWORD: dbPass };
    
    const dockerContainer = this.configService.get<string>('DOCKER_PG_CONTAINER');
    const dockerAvailable = dockerContainer ? await this.isCommandAvailable('docker') : false;
    const useDocker = Boolean(dockerContainer && dockerAvailable);

    if (dockerContainer && !dockerAvailable) {
      this.logger.warn(`DOCKER_PG_CONTAINER is set (${dockerContainer}) but docker CLI is unavailable. Falling back to local pg_dump.`);
    }

    if (!useDocker) {
      const pgDumpAvailable = await this.isCommandAvailable('pg_dump');
      if (!pgDumpAvailable) {
        throw new InternalServerErrorException(
          'Neither docker CLI nor pg_dump are available for backup. Install postgresql client tools or unset DOCKER_PG_CONTAINER.',
        );
      }
    }

    return new Promise((resolve, reject) => {
      let pgDump;
      let stderr = '';
      
      if (useDocker) {
        this.logger.log(`Using Docker container '${dockerContainer}' for backup`);
        // When using Docker, we execute pg_dump inside the container
        // We assume the container has the DB and credentials configured or accessible
        const args = ['exec', '-i'];
        if (dbPass) {
          args.push('-e', `PGPASSWORD=${dbPass}`);
        }
        args.push(dockerContainer!, 'pg_dump', '-U', dbUser, dbName);
        pgDump = spawn('docker', args);
      } else {
        // Standard local pg_dump
        pgDump = spawn('pg_dump', [
          '-h', dbHost,
          '-p', dbPort,
          '-U', dbUser,
          '-F', 'p', // Plain text format (sql)
          dbName
        ], { env });
      }

      const gzip = spawn('gzip');

      pgDump.stdout.pipe(gzip.stdin);
      pgDump.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      const uploadStream = new Readable().wrap(gzip.stdout);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: uploadStream,
          ContentType: 'application/gzip',
        },
      });

      const uploadPromise = upload.done();

      const pgDumpPromise = new Promise<void>((resolvePg, rejectPg) => {
        pgDump.on('error', (err) => {
          this.logger.error(`pg_dump failed to spawn: ${err.message}`);
          if ((err as any).code === 'ENOENT') {
            this.logger.error('pg_dump executable not found. Please ensure PostgreSQL client tools are installed.');
          }
          rejectPg(err);
        });

        pgDump.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            const details = stderr.trim();
            const message = details
              ? `pg_dump exited with code ${code}: ${details}`
              : `pg_dump exited with code ${code}`;
            this.logger.error(message);
            rejectPg(new Error(message));
            return;
          }
          resolvePg();
        });
      });

      const gzipPromise = new Promise<void>((resolveGzip, rejectGzip) => {
        gzip.on('error', (err) => {
          this.logger.error(`gzip failed: ${err}`);
          rejectGzip(err);
        });

        gzip.on('close', (code) => {
          if (code !== 0 && code !== null) {
            rejectGzip(new Error(`gzip exited with code ${code}`));
            return;
          }
          resolveGzip();
        });
      });

      Promise.all([uploadPromise, pgDumpPromise, gzipPromise])
        .then(() => {
          this.logger.log(`Backup uploaded successfully: ${key}`);
          resolve({
            id,
            name: filename,
            date: new Date().toISOString(),
            size: 'Unknown (Streamed)',
            sizeBytes: 0,
            type,
            status: 'success' as const,
            key,
          });
        })
        .catch(async (err) => {
          this.logger.error(`Backup pipeline failed: ${err?.message || err}`);
          try {
            await this.s3Client.send(
              new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
              }),
            );
            this.logger.warn(`Removed failed backup artifact: ${key}`);
          } catch (cleanupError) {
            this.logger.warn(`Failed to clean failed backup artifact ${key}: ${cleanupError}`);
          }
          reject(err);
        });
    });
  }

  async pruneBackupsOlderThan(retentionDays: number): Promise<number> {
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      return 0;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: 'backups/',
        }),
      );

      const candidates = (listResponse.Contents || []).filter((item) => {
        if (!item?.Key || !item.Key.endsWith('.sql.gz') || !item.LastModified) {
          return false;
        }
        return item.LastModified.getTime() < cutoff.getTime();
      });

      if (candidates.length === 0) {
        return 0;
      }

      let deletedCount = 0;
      for (const item of candidates) {
        if (!item.Key) continue;
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: item.Key,
          }),
        );
        deletedCount += 1;
      }

      this.logger.log(`Pruned ${deletedCount} backup(s) older than ${retentionDays} day(s)`);
      return deletedCount;
    } catch (error) {
      this.logger.warn(`Failed to prune old backups: ${error}`);
      return 0;
    }
  }

  async restoreBackup(key: string): Promise<void> {
    this.logger.log(`Starting restore from backup: ${key}`);

    // Database connection details
    const dbHost = this.configService.get<string>('DB_HOST', 'localhost');
    const dbPort = this.configService.get<string>('DB_PORT', '5432');
    const dbUser = this.configService.get<string>('DB_USERNAME', 'postgres');
    const dbPass = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const dbName = this.resolveDatabaseName();

    // Get the object from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(getObjectCommand);
      const s3Stream = response.Body as Readable;

      if (!s3Stream) {
        throw new NotFoundException('Backup file not found or empty');
      }

      const dockerContainer = this.configService.get<string>('DOCKER_PG_CONTAINER');
      const dockerAvailable = dockerContainer ? await this.isCommandAvailable('docker') : false;
      const useDocker = Boolean(dockerContainer && dockerAvailable);
      if (dockerContainer && !dockerAvailable) {
        this.logger.warn(`DOCKER_PG_CONTAINER is set (${dockerContainer}) but docker CLI is unavailable. Falling back to local psql.`);
      }
      if (!useDocker) {
        const psqlAvailable = await this.isCommandAvailable('psql');
        if (!psqlAvailable) {
          throw new InternalServerErrorException(
            'Neither docker CLI nor psql are available for restore. Install postgresql client tools or unset DOCKER_PG_CONTAINER.',
          );
        }
      }

      return new Promise((resolve, reject) => {
        let psql;

        // Note: For a proper restore, we usually need to drop/clean the DB first.
        // But since this is a dangerous operation, we'll assume the backup file
        // or the psql command handles it (e.g. if we used -c in pg_dump).
        // Standard pg_dump -F p (plain) appends to existing if not cleaned.
        // For now, we will just pipe the SQL.
        
        if (useDocker) {
            this.logger.log(`Using Docker container '${dockerContainer}' for restore`);
            // docker exec -i container psql -U user dbname
            psql = spawn('docker', [
                'exec', '-i',
                '-e', `PGPASSWORD=${dbPass}`,
                dockerContainer,
                'psql',
                '-U', dbUser,
                dbName
            ]);
        } else {
             psql = spawn('psql', [
                '-h', dbHost,
                '-p', dbPort,
                '-U', dbUser,
                dbName
            ], { env: { ...process.env, PGPASSWORD: dbPass } });
        }

        const gunzip = spawn('gunzip', ['-c']);

        // Pipe S3 stream -> gunzip -> psql
        s3Stream.pipe(gunzip.stdin);
        gunzip.stdout.pipe(psql.stdin);

        psql.on('error', (err) => {
            this.logger.error(`psql failed: ${err.message}`);
            reject(err);
        });

        psql.on('exit', (code) => {
            if (code !== 0) {
                this.logger.error(`psql exited with code ${code}`);
                reject(new Error(`psql exited with code ${code}`));
            } else {
                this.logger.log('Database restore completed successfully');
                resolve();
            }
        });

        gunzip.on('error', (err) => {
            this.logger.error(`gunzip failed: ${err.message}`);
            reject(err);
        });
      });

    } catch (error) {
      this.logger.error(`Failed to restore backup: ${error}`);
      throw new InternalServerErrorException(`Restore failed: ${error.message}`);
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error}`);
      throw new InternalServerErrorException('Could not generate download link');
    }
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async isCommandAvailable(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checker = spawn('sh', ['-lc', `command -v ${command}`], {
        stdio: 'ignore',
      });
      checker.on('error', () => resolve(false));
      checker.on('close', (code) => resolve(code === 0));
    });
  }

  private resolveDatabaseName(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (databaseUrl) {
      try {
        const parsed = new URL(databaseUrl);
        const pathName = parsed.pathname?.replace(/^\//, '').trim();
        if (pathName) {
          return pathName;
        }
      } catch {
        // ignore parse errors and fallback below
      }
    }

    const fromPostgresDb = this.configService.get<string>('POSTGRES_DB');
    if (fromPostgresDb && fromPostgresDb.trim().length > 0) {
      return fromPostgresDb.trim();
    }

    const explicit = this.configService.get<string>('DB_DATABASE');
    if (explicit && explicit.trim().length > 0) {
      return explicit.trim();
    }

    return 'umoya';
  }
}
