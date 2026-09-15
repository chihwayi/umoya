import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SyncConflict {
  recordType: 'allergy' | 'active_medication';
  recordId: string;
  patientId: string;
  conflictField: string;
  serverValue: unknown;
  clientValue: unknown;
  clientTimestamp: string;
  serverTimestamp: string;
  clientDeviceId?: string;
}

export interface MergeResult {
  action: 'applied' | 'queued';
  queuedId?: string;
  reason: string;
}

// Real tables (not the phantom patient_allergies/active_medications this
// service originally referenced — confirmed live against the tenant schema).
const TABLE_BY_RECORD_TYPE: Record<SyncConflict['recordType'], string> = {
  allergy: 'allergies',
  active_medication: 'patient_medications',
};

// conflictField is attacker-controlled (POST /conflict-queue/sync/conflicts
// accepts SyncConflict[] straight from the request body, JwtAuthGuard only,
// no role restriction) and was previously interpolated raw as a column
// identifier — a SQL injection. Whitelisting every column BOTH tables can
// legitimately sync closes it; SAFETY_CRITICAL is now a subset of this,
// not an independent gate.
const SYNCABLE_FIELDS: Record<string, Set<string>> = {
  allergies: new Set(['allergen', 'severity', 'clinical_status', 'reaction', 'verification_status']),
  patient_medications: new Set(['medication_name', 'dosage', 'frequency', 'status', 'reason_for_discontinuation', 'route', 'notes']),
};

const SAFETY_CRITICAL: Record<string, Set<string>> = {
  allergies: new Set(['allergen', 'severity', 'clinical_status', 'reaction']),
  patient_medications: new Set(['medication_name', 'dosage', 'status', 'reason_for_discontinuation']),
};

// allergies has no updated_at column (patient_medications does) — confirmed
// live via \d allergies. Appending "updated_at = now()" unconditionally 500s
// on every allergy resolution, so gate it per table.
const TABLES_WITH_UPDATED_AT = new Set(['patient_medications']);

@Injectable()
export class ClinicalConflictResolutionService {
  private readonly logger = new Logger(ClinicalConflictResolutionService.name);

  async resolveConflict(tenantDb: DataSource, conflict: SyncConflict): Promise<MergeResult> {
    const table = TABLE_BY_RECORD_TYPE[conflict.recordType];
    if (!table) {
      throw new BadRequestException(`Unsupported recordType: ${conflict.recordType}`);
    }
    if (!SYNCABLE_FIELDS[table]?.has(conflict.conflictField)) {
      throw new BadRequestException(`Unsupported conflictField '${conflict.conflictField}' for ${conflict.recordType}`);
    }
    const isCritical = SAFETY_CRITICAL[table]?.has(conflict.conflictField) ?? false;

    if (!isCritical) {
      // Safe to LWW for non-critical fields
      if (new Date(conflict.clientTimestamp) > new Date(conflict.serverTimestamp)) {
        const touchUpdatedAt = TABLES_WITH_UPDATED_AT.has(table) ? ', updated_at = now()' : '';
        await tenantDb.query(
          `UPDATE ${table} SET "${conflict.conflictField}" = $1${touchUpdatedAt} WHERE id = $2`,
          [conflict.clientValue, conflict.recordId],
        );
      }
      return { action: 'applied', reason: 'lww_applied' };
    }

    // Safety-critical: always queue, never silently overwrite
    const [row] = await tenantDb.query(
      `INSERT INTO clinical_resolution_queue
         (patient_id, record_type, record_id, conflict_field,
          server_value, client_value, client_device_id, client_timestamp, server_timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        conflict.patientId,
        conflict.recordType,
        conflict.recordId,
        conflict.conflictField,
        JSON.stringify(conflict.serverValue),
        JSON.stringify(conflict.clientValue),
        conflict.clientDeviceId ?? null,
        conflict.clientTimestamp,
        conflict.serverTimestamp,
      ],
    );
    this.logger.warn(
      `Safety conflict queued: patient=${conflict.patientId} field=${conflict.conflictField} id=${row.id}`,
    );
    return { action: 'queued', queuedId: row.id, reason: 'safety_critical_requires_review' };
  }

  async resolveQueueEntry(
    tenantDb: DataSource,
    queueId: string,
    resolution: 'resolved_keep_server' | 'resolved_keep_client',
    resolvedBy: string,
    note?: string,
  ): Promise<void> {
    const [entry] = await tenantDb.query(
      `SELECT * FROM clinical_resolution_queue WHERE id = $1`,
      [queueId],
    );
    if (!entry) throw new Error(`Queue entry ${queueId} not found`);

    const valueToApply =
      resolution === 'resolved_keep_client' ? entry.client_value : entry.server_value;
    const table = TABLE_BY_RECORD_TYPE[entry.record_type as SyncConflict['recordType']];
    if (!table || !SYNCABLE_FIELDS[table]?.has(entry.conflict_field)) {
      throw new BadRequestException(`Unsupported conflictField '${entry.conflict_field}' for ${entry.record_type}`);
    }

    const touchUpdatedAt = TABLES_WITH_UPDATED_AT.has(table) ? ', updated_at = now()' : '';
    await tenantDb.query(
      `UPDATE ${table} SET "${entry.conflict_field}" = $1${touchUpdatedAt} WHERE id = $2`,
      [valueToApply, entry.record_id],
    );
    await tenantDb.query(
      `UPDATE clinical_resolution_queue
       SET status=$1, resolved_by=$2, resolved_at=now(), resolution_note=$3, updated_at=now()
       WHERE id=$4`,
      [resolution, resolvedBy, note ?? null, queueId],
    );
  }

  async getPendingForPatient(tenantDb: DataSource, patientId: string): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM clinical_resolution_queue
       WHERE patient_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [patientId],
    );
  }

  async getAllPending(tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT crq.*,
         p.first_name, p.last_name
       FROM clinical_resolution_queue crq
       LEFT JOIN patients p ON p.id::text = crq.patient_id::text
       WHERE crq.status = 'pending'
       ORDER BY crq.created_at ASC`,
    );
  }

  async getPendingCount(tenantDb: DataSource): Promise<number> {
    const [row] = await tenantDb.query(
      `SELECT COUNT(*)::int AS count FROM clinical_resolution_queue WHERE status = 'pending'`,
    );
    return row.count;
  }

  async escalateStale(tenantDb: DataSource): Promise<number> {
    const rows = await tenantDb.query(
      `UPDATE clinical_resolution_queue
       SET status='escalated', escalated_at=now(), updated_at=now()
       WHERE status='pending' AND created_at < now() - interval '2 hours'
       RETURNING id`,
    );
    return rows.length;
  }
}
