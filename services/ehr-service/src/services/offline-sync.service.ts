import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SyncQueueLog } from '../entities/sync-queue-log.entity';

interface SyncOperation {
  clientId: string;
  operationType: 'create' | 'update';
  entityType: string;
  entityId?: string;
  payload: Record<string, any>;
  clientTimestamp: string;
}

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(private readonly tenantService: TenantService) {}

  async processBatch(subdomain: string, operations: SyncOperation[]) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const results: any[] = [];

    for (const op of operations) {
      const logEntry: Partial<SyncQueueLog> = {
        clientId: op.clientId,
        operationType: op.operationType,
        entityType: op.entityType,
        entityId: op.entityId as any,
        payload: op.payload,
        clientTimestamp: new Date(op.clientTimestamp),
        serverTimestamp: new Date(),
        syncStatus: 'pending',
      };

      try {
        const result = await this.applyOperation(ds, op);
        logEntry.syncStatus = 'synced';
        logEntry.entityId = result?.id || op.entityId;
        results.push({ clientTimestamp: op.clientTimestamp, status: 'synced', id: result?.id });
      } catch (e: any) {
        if (e.code === 'CONFLICT') {
          logEntry.syncStatus = 'conflict';
          logEntry.conflictDetails = e.details;
          results.push({ clientTimestamp: op.clientTimestamp, status: 'conflict', details: e.details });
        } else {
          logEntry.syncStatus = 'failed';
          results.push({ clientTimestamp: op.clientTimestamp, status: 'failed', error: e.message });
        }
      }

      await ds.getRepository(SyncQueueLog).save(ds.getRepository(SyncQueueLog).create(logEntry as SyncQueueLog));
    }

    return { processed: operations.length, results };
  }

  async getCheckpoint(subdomain: string, userId: string, since: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const sinceDate = new Date(since);
    // Return entities modified since last sync — vitals, notes, prescriptions
    const [vitals, notes] = await Promise.all([
      ds.query(`SELECT * FROM vitals WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT 500`, [sinceDate]).catch(() => []),
      ds.query(`SELECT id, patient_id, updated_at FROM medical_records WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT 200`, [sinceDate]).catch(() => []),
    ]);
    return {
      checkpoint: new Date().toISOString(),
      changes: { vitals, notes },
    };
  }

  async getPendingQueue(subdomain: string, clientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SyncQueueLog).find({
      where: { clientId, syncStatus: 'pending' },
      order: { clientTimestamp: 'ASC' },
    });
  }

  private async applyOperation(ds: any, op: SyncOperation): Promise<any> {
    const entityToTable: Record<string, string> = {
      vitals: 'vitals',
      medical_record: 'medical_records',
      prescription: 'prescriptions',
      lab_order: 'lab_orders',
    };
    const table = entityToTable[op.entityType];
    if (!table) throw new Error(`Unknown entity type: ${op.entityType}`);

    if (op.operationType === 'create') {
      const cols = Object.keys(op.payload).join(', ');
      const vals = Object.values(op.payload);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const result = await ds.query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING id`,
        vals
      );
      return result[0];
    }

    if (op.operationType === 'update' && op.entityId) {
      const updates = Object.entries(op.payload).map(([k], i) => `${k} = $${i + 1}`).join(', ');
      const vals = [...Object.values(op.payload), op.entityId];
      await ds.query(`UPDATE ${table} SET ${updates} WHERE id = $${vals.length}`, vals);
      return { id: op.entityId };
    }

    throw new Error(`Unsupported operation: ${op.operationType}`);
  }
}
