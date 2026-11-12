import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getMasterDbConfig } from '../utils/runtime-env';

// S285 — Clinician Network master-DB connection. The clinician_network schema lives
// in the shared master database (NOT any tenant database), provisioned via the
// clinician_network_platform bundle in database-provisioning.service.ts — a deliberate,
// documented exception to the per-tenant golden rule. Connection pattern mirrors
// TerminologyService.initializeMasterDb()/getMasterDb() (same getMasterDbConfig helper,
// same lazy-init-with-retry DataSource). Raw SQL via query() matches the
// TerminologyPostgresService style — no new ORM/entity pattern for this schema.

const MAX_INIT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ClinicianNetworkMasterDbService {
  private readonly logger = new Logger(ClinicianNetworkMasterDbService.name);
  private masterDb: DataSource | null = null;
  private initPromise: Promise<DataSource> | null = null;

  async getMasterDb(): Promise<DataSource> {
    if (this.masterDb && this.masterDb.isInitialized) {
      return this.masterDb;
    }
    if (!this.initPromise) {
      this.initPromise = this.initializeMasterDb().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async initializeMasterDb(): Promise<DataSource> {
    const cfg = getMasterDbConfig(process.env.MASTER_POSTGRES_DB || process.env.POSTGRES_DB || 'umoya');
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt += 1) {
      try {
        const ds = new DataSource({
          type: 'postgres',
          host: cfg.host,
          port: cfg.port,
          username: cfg.username,
          password: cfg.password,
          database: cfg.database,
        });
        await ds.initialize();
        this.masterDb = ds;
        this.logger.log('Master database connected for Clinician Network');
        return ds;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Clinician Network master DB connect attempt ${attempt}/${MAX_INIT_ATTEMPTS} failed: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < MAX_INIT_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
    throw new Error(
      `Clinician Network master database connection unavailable: ` +
        `${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const db = await this.getMasterDb();
    return db.query(sql, params);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.masterDb && this.masterDb.isInitialized) {
      await this.masterDb.destroy();
      this.masterDb = null;
    }
  }
}
