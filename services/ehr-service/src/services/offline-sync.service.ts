import { Injectable, Logger, Optional } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SyncQueueLog } from '../entities/sync-queue-log.entity';
import { ConflictResolverService } from './conflict-resolver.service';

interface SyncOperation {
  clientId: string;
  /** S225: stable per-op idempotency key (preferred replay-detection key). */
  clientOpId?: string;
  operationType: 'create' | 'update';
  entityType: string;
  entityId?: string;
  payload: Record<string, any>;
  clientTimestamp: string;
}

/** Postgres identifiers we allow from client payload keys — defense in depth. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(
    private readonly tenantService: TenantService,
    @Optional() private readonly conflictResolver?: ConflictResolverService,
  ) {}

  async processBatch(subdomain: string, operations: SyncOperation[]) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const results: any[] = [];

    for (const op of operations) {
      // Idempotent replay: a device that lost power/network mid-response will
      // resend the same batch. An op already recorded as synced for this
      // (clientId, clientTimestamp, entityType) must not be applied twice.
      const replayed = await this.findSyncedReplay(ds, op);
      if (replayed) {
        results.push({
          clientTimestamp: op.clientTimestamp,
          status: 'already_synced',
          id: replayed.entityId ?? op.entityId,
        });
        continue;
      }

      const logEntry: Partial<SyncQueueLog> = {
        clientId: op.clientId,
        clientOpId: op.clientOpId,
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
        logEntry.syncStatus = result?.conflict ? 'conflict' : 'synced';
        logEntry.entityId = result?.id || op.entityId;
        if (result?.conflict) {
          logEntry.conflictDetails = result.conflict;
          results.push({ clientTimestamp: op.clientTimestamp, status: 'conflict', details: result.conflict });
        } else {
          results.push({ clientTimestamp: op.clientTimestamp, status: 'synced', id: result?.id });
        }
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

      // Queue durability: every applied/conflicted/failed op leaves a log row,
      // even when the apply itself threw.
      await ds.getRepository(SyncQueueLog).save(ds.getRepository(SyncQueueLog).create(logEntry as SyncQueueLog));
    }

    return { processed: operations.length, results };
  }

  private async findSyncedReplay(ds: any, op: SyncOperation): Promise<SyncQueueLog | null> {
    try {
      // Prefer the explicit per-op idempotency key when the client sends one;
      // fall back to the (clientId, entityType, clientTimestamp) tuple for
      // pre-S225 clients.
      if (op.clientOpId) {
        const byOpId = await ds.getRepository(SyncQueueLog).findOne({
          where: { clientOpId: op.clientOpId, syncStatus: 'synced' },
        });
        if (byOpId) return byOpId;
      }
      const existing = await ds.getRepository(SyncQueueLog).findOne({
        where: {
          clientId: op.clientId,
          entityType: op.entityType,
          clientTimestamp: new Date(op.clientTimestamp),
          syncStatus: 'synced',
        },
      });
      return existing ?? null;
    } catch {
      return null;
    }
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

  private assertSafeIdentifiers(payload: Record<string, any>): void {
    for (const key of Object.keys(payload)) {
      if (!SAFE_IDENTIFIER.test(key)) {
        throw new Error(`Invalid field name in sync payload: ${key}`);
      }
    }
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

    // Payload keys are interpolated as SQL identifiers — validate them.
    this.assertSafeIdentifiers(op.payload);

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
      // Conflict-aware update: when the server row changed after the client's
      // edit, resolve through the ConflictResolverService (safe-merge, safety
      // fields queued for clinician review) instead of blindly overwriting.
      if (this.conflictResolver) {
        const [serverRow] = await ds.query(`SELECT * FROM ${table} WHERE id = $1`, [op.entityId]);
        if (!serverRow) {
          throw new Error(`Entity not found for update: ${op.entityType}/${op.entityId}`);
        }
        const serverTs = serverRow.updated_at ? new Date(serverRow.updated_at).getTime() : 0;
        const clientTs = new Date(op.clientTimestamp).getTime();

        if (serverTs > clientTs) {
          const clientVersion = { ...op.payload, updated_at: op.clientTimestamp };
          const conflict = await this.conflictResolver.resolveConflict(
            table,
            op.entityId,
            clientVersion,
            serverRow,
            ds,
            serverRow.patient_id,
          );

          if (conflict.resolution === 'rejected' || conflict.resolution === 'server_wins' || conflict.resolution === 'queued_for_review') {
            return {
              id: op.entityId,
              conflict: {
                resolution: conflict.resolution,
                queuedConflictIds: conflict.queuedConflictIds,
              },
            };
          }

          // merge: apply only the merged client-visible fields from the payload.
          const mergedUpdates: Record<string, any> = {};
          for (const key of Object.keys(op.payload)) {
            if (conflict.merged && key in conflict.merged) {
              mergedUpdates[key] = (conflict.merged as any)[key];
            }
          }
          if (Object.keys(mergedUpdates).length === 0) {
            return { id: op.entityId };
          }
          const updates = Object.keys(mergedUpdates).map((k, i) => `${k} = $${i + 1}`).join(', ');
          const vals = [...Object.values(mergedUpdates), op.entityId];
          await ds.query(`UPDATE ${table} SET ${updates} WHERE id = $${vals.length}`, vals);
          return { id: op.entityId };
        }
      }

      const updates = Object.entries(op.payload).map(([k], i) => `${k} = $${i + 1}`).join(', ');
      const vals = [...Object.values(op.payload), op.entityId];
      await ds.query(`UPDATE ${table} SET ${updates} WHERE id = $${vals.length}`, vals);
      return { id: op.entityId };
    }

    throw new Error(`Unsupported operation: ${op.operationType}`);
  }
}
