import { Injectable, Logger } from '@nestjs/common';

type Resolution = 'merge' | 'server_wins' | 'client_wins' | 'rejected';

const SERVER_ALWAYS_WINS = new Set(['appointments', 'lab_results']);
const IMMUTABLE_ENTITIES = new Set(['lab_results', 'hiv_resistance_assessments']);
const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'tenant_id', 'patient_id']);

export interface ConflictResult {
  resolution: Resolution;
  merged: Record<string, unknown> | null;
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
  ): Promise<ConflictResult> {
    if (IMMUTABLE_ENTITIES.has(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'rejected', db);
      return { resolution: 'rejected', merged: null };
    }

    if (SERVER_ALWAYS_WINS.has(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'server_wins', db);
      return { resolution: 'server_wins', merged: serverVersion };
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
