import { Injectable, Logger } from '@nestjs/common';
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

const SAFETY_CRITICAL: Record<string, Set<string>> = {
  patient_allergies:  new Set(['allergen', 'severity', 'status', 'reaction_type']),
  active_medications: new Set(['drug_name', 'dose', 'status', 'stopped_reason']),
};

@Injectable()
export class ClinicalConflictResolutionService {
  private readonly logger = new Logger(ClinicalConflictResolutionService.name);

  async resolveConflict(tenantDb: DataSource, conflict: SyncConflict): Promise<MergeResult> {
    const table =
      conflict.recordType === 'allergy' ? 'patient_allergies' : 'active_medications';
    const isCritical = SAFETY_CRITICAL[table]?.has(conflict.conflictField) ?? false;

    if (!isCritical) {
      // Safe to LWW for non-critical fields
      if (new Date(conflict.clientTimestamp) > new Date(conflict.serverTimestamp)) {
        await tenantDb.query(
          `UPDATE ${table} SET "${conflict.conflictField}" = $1, updated_at = now() WHERE id = $2`,
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
    const table =
      entry.record_type === 'allergy' ? 'patient_allergies' : 'active_medications';

    await tenantDb.query(
      `UPDATE ${table} SET "${entry.conflict_field}" = $1, updated_at = now() WHERE id = $2`,
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
