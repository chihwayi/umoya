import { Injectable, Logger } from '@nestjs/common';

type Resolution = 'merge' | 'server_wins' | 'client_wins' | 'rejected' | 'queued_for_review';

const SERVER_ALWAYS_WINS = new Set(['appointments', 'lab_results']);
const IMMUTABLE_ENTITIES = new Set(['lab_results', 'hiv_resistance_assessments']);

// Fields on these tables that must never be silently overwritten via LWW
const SAFETY_CRITICAL_FIELDS: Record<string, Set<string>> = {
  patient_allergies:  new Set(['allergen', 'severity', 'status', 'reaction_type']),
  active_medications: new Set(['drug_name', 'dose', 'status', 'stopped_reason']),
};
const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'tenant_id', 'patient_id']);

export interface ConflictResult {
  resolution: Resolution;
  merged: Record<string, unknown> | null;
  queuedConflictIds?: string[];
}

@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  async resolveConflict(
    entityType: string,
    entityId: string,
    clientVersion: Record<string, unknown>,
    serverVersion: Record<string, unknown>,
    db: any,
    patientId?: string,
  ): Promise<ConflictResult> {
    if (IMMUTABLE_ENTITIES.has(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'rejected', db);
      return { resolution: 'rejected', merged: null };
    }

    if (SERVER_ALWAYS_WINS.has(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'server_wins', db);
      return { resolution: 'server_wins', merged: serverVersion };
    }

    // Safety-critical path: queue any changed safety fields instead of applying LWW
    const safetyFields = SAFETY_CRITICAL_FIELDS[entityType];
    if (safetyFields && patientId && db) {
      const queuedIds: string[] = [];
      for (const field of safetyFields) {
        const clientVal = clientVersion[field];
        const serverVal = serverVersion[field];
        if (clientVal !== undefined && JSON.stringify(clientVal) !== JSON.stringify(serverVal)) {
          try {
            const [row] = await db.query(
              `INSERT INTO clinical_resolution_queue
                 (patient_id, record_type, record_id, conflict_field,
                  server_value, client_value,
                  client_timestamp, server_timestamp)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               RETURNING id`,
              [
                patientId,
                entityType === 'patient_allergies' ? 'allergy' : 'active_medication',
                entityId,
                field,
                JSON.stringify(serverVal ?? null),
                JSON.stringify(clientVal),
                (clientVersion['updated_at'] as string) ?? new Date().toISOString(),
                (serverVersion['updated_at'] as string) ?? new Date().toISOString(),
              ],
            );
            queuedIds.push(row.id);
            this.logger.warn(
              `Safety conflict queued: entity=${entityType} field=${field} patient=${patientId} id=${row.id}`,
            );
          } catch (err: any) {
            this.logger.warn(`Failed to queue safety conflict: ${err?.message}`);
          }
        }
      }
      if (queuedIds.length > 0) {
        await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'queued_for_review', db);
        return { resolution: 'queued_for_review', merged: serverVersion, queuedConflictIds: queuedIds };
      }
    }

    const merged = this.fieldLevelMerge(clientVersion, serverVersion);
    const resolution: Resolution = 'merge';

    await this.logConflict(entityType, entityId, clientVersion, serverVersion, resolution, db);
    return { resolution, merged };
  }

  fieldLevelMerge(
    client: Record<string, unknown>,
    server: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...server };

    const clientTs = client['updated_at'] ? new Date(client['updated_at'] as string).getTime() : 0;
    const serverTs = server['updated_at'] ? new Date(server['updated_at'] as string).getTime() : 0;

    for (const [key, clientValue] of Object.entries(client)) {
      if (SKIP_FIELDS.has(key)) continue;

      const serverValue = server[key];
      const fieldChanged = JSON.stringify(clientValue) !== JSON.stringify(serverValue);

      if (fieldChanged && clientTs > serverTs) {
        merged[key] = clientValue;
      }
    }

    this.logger.debug(`fieldLevelMerge ${JSON.stringify({ clientTs, serverTs })}`);
    return merged;
  }

  private async logConflict(
    entityType: string,
    entityId: string,
    clientVersion: Record<string, unknown>,
    serverVersion: Record<string, unknown>,
    resolution: string,
    db: any,
  ): Promise<void> {
    if (!db) return;
    await db
      .query(
        `INSERT INTO sync_conflicts (entity_type, entity_id, client_version, server_version, resolution)
         VALUES ($1, $2, $3, $4, $5)`,
        [entityType, entityId, JSON.stringify(clientVersion), JSON.stringify(serverVersion), resolution],
      )
      .catch((err: any) => this.logger.warn(`conflict log failed: ${err?.message}`));
  }
}
