import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';

export enum HipaaAuditAction {
  // Authentication & Authorization
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  SESSION_EXPIRED = 'session_expired',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',

  // PHI Access (Read)
  PATIENT_VIEW = 'patient_view',
  MEDICAL_RECORD_VIEW = 'medical_record_view',
  PRESCRIPTION_VIEW = 'prescription_view',
  LAB_RESULT_VIEW = 'lab_result_view',
  IMAGING_VIEW = 'imaging_view',
  VITALS_VIEW = 'vitals_view',
  ALLERGY_VIEW = 'allergy_view',
  PROBLEM_VIEW = 'problem_view',
  APPOINTMENT_VIEW = 'appointment_view',
  BILLING_VIEW = 'billing_view',
  SEARCH_PATIENTS = 'search_patients',
  EXPORT_DATA = 'export_data',
  PRINT_DOCUMENT = 'print_document',

  // PHI Modification (Write)
  PATIENT_CREATE = 'patient_create',
  PATIENT_UPDATE = 'patient_update',
  PATIENT_DELETE = 'patient_delete',
  MEDICAL_RECORD_CREATE = 'medical_record_create',
  MEDICAL_RECORD_UPDATE = 'medical_record_update',
  MEDICAL_RECORD_DELETE = 'medical_record_delete',
  PRESCRIPTION_CREATE = 'prescription_create',
  PRESCRIPTION_UPDATE = 'prescription_update',
  PRESCRIPTION_DELETE = 'prescription_delete',
  LAB_ORDER_CREATE = 'lab_order_create',
  LAB_ORDER_UPDATE = 'lab_order_update',
  LAB_RESULT_UPDATE = 'lab_result_update',
  IMAGING_CREATE = 'imaging_create',
  IMAGING_UPDATE = 'imaging_update',
  VITALS_CREATE = 'vitals_create',
  VITALS_UPDATE = 'vitals_update',
  ALLERGY_CREATE = 'allergy_create',
  ALLERGY_UPDATE = 'allergy_update',
  ALLERGY_DELETE = 'allergy_delete',
  PROBLEM_CREATE = 'problem_create',
  PROBLEM_UPDATE = 'problem_update',
  PROBLEM_DELETE = 'problem_delete',
  APPOINTMENT_CREATE = 'appointment_create',
  APPOINTMENT_UPDATE = 'appointment_update',
  APPOINTMENT_DELETE = 'appointment_delete',

  // System Events
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  BACKUP_CREATED = 'backup_created',
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  USER_ROLE_CHANGE = 'user_role_change',
  PERMISSION_CHANGE = 'permission_change',

  // CDSS Copilot Events
  CDSS_TRIAGE_ANALYZE = 'cdss_triage_analyze',
  CDSS_VITALS_INTERPRET = 'cdss_vitals_interpret',
  CDSS_NOTES_DRAFT = 'cdss_notes_draft',
  CDSS_HANDOFF_SUMMARY = 'cdss_handoff_summary',
  CDSS_GUIDELINES_SEARCH = 'cdss_guidelines_search',
  NURSE_TASK_COMPLETE = 'nurse_task_complete',
  NURSE_ALERT_ACKNOWLEDGE = 'nurse_alert_acknowledge',
  NURSE_HANDOFF_FINALIZE = 'nurse_handoff_finalize',
  NURSE_HANDOFF_REVIEW_CONFIRM = 'nurse_handoff_review_confirm',
  NURSE_HANDOFF_SHARE = 'nurse_handoff_share',
  NURSE_CROSS_MODULE_ACKNOWLEDGE = 'nurse_cross_module_acknowledge',
  NURSE_CROSS_MODULE_COMPLETE = 'nurse_cross_module_complete',

  // Breach Events
  BREACH_DETECTED = 'breach_detected',
  BREACH_REPORTED = 'breach_reported',
  BREACH_RESOLVED = 'breach_resolved',
  UNAUTHORIZED_DATA_ACCESS = 'unauthorized_data_access',
  BULK_DATA_ACCESS = 'bulk_data_access',
}

export interface HipaaAuditLogEntry {
  userId: string;
  userName?: string;
  userRole?: string;
  action: HipaaAuditAction;
  resourceType: string; // 'patient', 'medical_record', 'prescription', etc.
  resourceId?: string;
  patientId?: string; // Always log patient ID when PHI is accessed
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  outcome: 'success' | 'failure' | 'denied';
  reason?: string; // Reason for failure/denial
  dataAccessed?: {
    fields: string[]; // Which PHI fields were accessed
    recordCount?: number; // Number of records accessed
  };
  oldValues?: any; // For updates
  newValues?: any; // For updates
  metadata?: Record<string, any>; // Additional context
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface ModelRegistryEntry {
  modelId: string;
  modelName: string;
  modelVersion: string;
  provider?: string;
  status?: 'active' | 'retired' | 'testing';
  sha256Hash?: string | null;
  benchmarkScores?: any[];
  metadata?: Record<string, any>;
}

export interface PromptAuditLogEntry {
  promptHash: string;
  templateVersion?: string;
  modelId: string;
  sessionId?: string | null;
  patientId?: string | null;
  encounterId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  inputTokenCount?: number;
  outputTokenCount?: number;
  latencyMs?: number;
  safetyGateTriggered?: boolean;
  requestId?: string | null;
  metadata?: Record<string, any>;
}

@Injectable()
export class HipaaAuditService {
  private readonly logger = new Logger(HipaaAuditService.name);
  private readonly ensuredSchema = new WeakSet<DataSource>();

  private async ensureAdvancedAuditSchema(tenantDb: DataSource): Promise<void> {
    if (this.ensuredSchema.has(tenantDb)) {
      return;
    }

    const statements = [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `ALTER TABLE IF EXISTS hipaa_audit_logs
        ADD COLUMN IF NOT EXISTS event_type VARCHAR(80),
        ADD COLUMN IF NOT EXISTS operation VARCHAR(20)
          CHECK (operation IN ('READ', 'WRITE', 'DELETE', 'EXPORT', 'PRINT', 'SHARE')),
        ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20)
          CHECK (data_classification IN ('PHI', 'CLINICAL', 'BILLING', 'ADMIN')),
        ADD COLUMN IF NOT EXISTS request_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,
        ADD COLUMN IF NOT EXISTS changes_delta JSONB,
        ADD COLUMN IF NOT EXISTS immutable BOOLEAN NOT NULL DEFAULT TRUE`,
      `UPDATE hipaa_audit_logs SET immutable = TRUE WHERE immutable IS DISTINCT FROM TRUE`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_event_type ON hipaa_audit_logs(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_operation ON hipaa_audit_logs(operation)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_data_classification ON hipaa_audit_logs(data_classification)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_request_id ON hipaa_audit_logs(request_id)`,
      `CREATE TABLE IF NOT EXISTS audit_integrity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_date DATE NOT NULL UNIQUE,
        event_count INTEGER NOT NULL DEFAULT 0,
        merkle_root_hash TEXT NOT NULL,
        chain_hash TEXT,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_integrity_generated_at ON audit_integrity_log(generated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_integrity_date ON audit_integrity_log(audit_date DESC)`,
      `CREATE TABLE IF NOT EXISTS model_registry (
        model_id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_version TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local',
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'retired', 'testing')),
        sha256_hash TEXT,
        benchmark_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
        deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        retired_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status)`,
      `CREATE INDEX IF NOT EXISTS idx_model_registry_model_name ON model_registry(model_name)`,
      `CREATE INDEX IF NOT EXISTS idx_model_registry_deployed_at ON model_registry(deployed_at DESC)`,
      `CREATE TABLE IF NOT EXISTS prompt_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_hash TEXT NOT NULL,
        template_version TEXT NOT NULL DEFAULT 'v1',
        model_id TEXT NOT NULL REFERENCES model_registry(model_id) ON DELETE RESTRICT,
        session_id UUID REFERENCES post_visit_sessions(id) ON DELETE SET NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        encounter_id UUID,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_role VARCHAR(40),
        input_token_count INTEGER NOT NULL DEFAULT 0,
        output_token_count INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        safety_gate_triggered BOOLEAN NOT NULL DEFAULT FALSE,
        request_id VARCHAR(120),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_prompt_hash ON prompt_audit_log(prompt_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_model_id ON prompt_audit_log(model_id)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_patient_id ON prompt_audit_log(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_session_id ON prompt_audit_log(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_created_at ON prompt_audit_log(created_at DESC)`,
      `CREATE OR REPLACE FUNCTION prevent_hipaa_audit_logs_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'hipaa_audit_logs is append-only and cannot be %', TG_OP;
        END;
        $$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_update ON hipaa_audit_logs`,
      `CREATE TRIGGER trg_prevent_hipaa_audit_logs_update
        BEFORE UPDATE ON hipaa_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation()`,
      `DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_delete ON hipaa_audit_logs`,
      `CREATE TRIGGER trg_prevent_hipaa_audit_logs_delete
        BEFORE DELETE ON hipaa_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation()`,
    ];

    for (const statement of statements) {
      await tenantDb.query(statement);
    }

    this.ensuredSchema.add(tenantDb);
  }

  /**
   * Log HIPAA-compliant audit event
   */
  async logAuditEvent(
    tenantDb: DataSource,
    entry: HipaaAuditLogEntry,
  ): Promise<void> {
    try {
      await this.ensureAdvancedAuditSchema(tenantDb);

      // Skip logging if userId is 'anonymous' or invalid (not a valid UUID)
      // This happens for unauthenticated requests or patient portal users
      if (entry.userId === 'anonymous' || !entry.userId || entry.userId === 'undefined' || entry.userId === 'unknown') {
        // For patient portal users, we track via patient_id instead of user_id
        // So we can still log if there's a patient_id
        if (!entry.patientId) {
          return; // Skip if no patient_id either
        }
        // Continue to log with NULL user_id for patient portal access
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let normalizedUserId: string | null = null;
      if (entry.userId && uuidRegex.test(entry.userId)) {
        normalizedUserId = entry.userId;
      } else if (entry.patientId) {
        // Patient portal/non-user principal access still needs PHI audit coverage.
        normalizedUserId = null;
      } else {
        this.logger.debug(`Skipping audit log for non-UUID user without patient context: ${entry.userId}`);
        return;
      }

      const operation = this.mapOperation(entry.action);
      const dataClassification = this.mapDataClassification(entry.resourceType, operation);
      const eventType = this.mapEventType(entry.action, operation, entry.outcome);
      const requestId = String(entry.metadata?.requestId || entry.metadata?.request_id || '').trim() || null;
      const ipAddressHash = this.hashIpAddress(entry.ipAddress);
      const changesDelta = this.buildChangesDelta(entry.oldValues, entry.newValues);

      await tenantDb.query(
        `
        INSERT INTO hipaa_audit_logs (
          user_id, user_name, user_role, action, resource_type, resource_id,
          patient_id, ip_address, user_agent, session_id, outcome, reason,
          data_accessed, old_values, new_values, metadata, risk_level, created_at,
          event_type, operation, data_classification, request_id, ip_address_hash, changes_delta, immutable
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18,
          $19, $20, $21, $22, $23, $24::jsonb, true
        )
      `,
        [
          normalizedUserId,
          entry.userName || null,
          entry.userRole || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          entry.patientId || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.sessionId || null,
          entry.outcome,
          entry.reason || null,
          entry.dataAccessed ? JSON.stringify(entry.dataAccessed) : null,
          entry.oldValues ? JSON.stringify(entry.oldValues) : null,
          entry.newValues ? JSON.stringify(entry.newValues) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.riskLevel || 'low',
          entry.timestamp || new Date(),
          eventType,
          operation,
          dataClassification,
          requestId,
          ipAddressHash,
          changesDelta ? JSON.stringify(changesDelta) : null,
        ],
      );

      await this.upsertAuditIntegrityForDate(tenantDb, entry.timestamp || new Date(), normalizedUserId);
    } catch (error: any) {
      // Never fail the main operation due to audit logging failure
      // But log the error for investigation
      this.logger.error(`Failed to log audit event: ${error.message}`, error.stack);
    }
  }

  /**
   * Log PHI access (read operations)
   */
  async logPhiAccess(
    tenantDb: DataSource,
    userId: string,
    userName: string,
    userRole: string,
    action: HipaaAuditAction,
    resourceType: string,
    resourceId: string | undefined | null,
    patientId: string | undefined | null,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    dataAccessed?: { fields: string[]; recordCount?: number },
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuditEvent(tenantDb, {
      userId,
      userName,
      userRole,
      action,
      resourceType,
      resourceId,
      patientId,
      ipAddress,
      userAgent,
      sessionId,
      outcome: 'success',
      dataAccessed,
      metadata,
      riskLevel: this.calculateRiskLevel(action, dataAccessed?.recordCount),
      timestamp: new Date(),
    });
  }

  /**
   * Log PHI modification (write operations)
   */
  async logPhiModification(
    tenantDb: DataSource,
    userId: string,
    userName: string,
    userRole: string,
    action: HipaaAuditAction,
    resourceType: string,
    resourceId: string,
    patientId: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuditEvent(tenantDb, {
      userId,
      userName,
      userRole,
      action,
      resourceType,
      resourceId: resourceId || undefined,
      patientId: patientId || undefined,
      ipAddress,
      userAgent,
      sessionId,
      outcome: 'success',
      oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : undefined,
      newValues,
      metadata,
      riskLevel: 'medium', // Modifications are generally medium risk
      timestamp: new Date(),
    });
  }

  /**
   * Log failed access attempt
   */
  async logFailedAccess(
    tenantDb: DataSource,
    userId: string | null,
    action: HipaaAuditAction,
    resourceType: string,
    resourceId: string | null,
    patientId: string | null,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuditEvent(tenantDb, {
      userId: userId || 'anonymous',
      action,
      resourceType,
      resourceId: resourceId || null,
      patientId: patientId || null,
      ipAddress,
      userAgent,
      outcome: 'denied',
      reason,
      metadata,
      riskLevel: 'high', // Failed access attempts are high risk
      timestamp: new Date(),
    });
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    tenantDb: DataSource,
    userId: string,
    userName: string,
    userRole: string,
    action: HipaaAuditAction,
    outcome: 'success' | 'failure',
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.logAuditEvent(tenantDb, {
      userId,
      userName,
      userRole,
      action,
      resourceType: 'authentication',
      ipAddress,
      userAgent,
      sessionId,
      outcome,
      reason,
      riskLevel: outcome === 'failure' ? 'high' : 'low',
      timestamp: new Date(),
    });
  }

  /**
   * Log data export (high-risk operation)
   */
  async logDataExport(
    tenantDb: DataSource,
    userId: string,
    userName: string,
    userRole: string,
    exportType: string,
    recordCount: number,
    patientIds?: string[],
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuditEvent(tenantDb, {
      userId,
      userName,
      userRole,
      action: HipaaAuditAction.DATA_EXPORT,
      resourceType: exportType,
      patientId: patientIds?.length === 1 ? patientIds[0] : undefined,
      ipAddress,
      userAgent,
      sessionId,
      outcome: 'success',
      dataAccessed: {
        fields: ['all'], // Export typically includes all fields
        recordCount,
      },
      metadata: {
        ...metadata,
        patientCount: patientIds?.length || 0,
        patientIds: patientIds?.length && patientIds.length <= 10 ? patientIds : undefined, // Only log if small number
      },
      riskLevel: recordCount > 100 ? 'critical' : recordCount > 10 ? 'high' : 'medium',
      timestamp: new Date(),
    });
  }

  async registerModelEntry(
    tenantDb: DataSource,
    entry: ModelRegistryEntry,
  ): Promise<void> {
    await this.ensureAdvancedAuditSchema(tenantDb);
    if (!entry?.modelId || !entry?.modelName || !entry?.modelVersion) {
      return;
    }

    await tenantDb.query(
      `
        INSERT INTO model_registry (
          model_id,
          model_name,
          model_version,
          provider,
          status,
          sha256_hash,
          benchmark_scores,
          metadata,
          deployed_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW(),NOW())
        ON CONFLICT (model_id) DO UPDATE
        SET model_name = EXCLUDED.model_name,
            model_version = EXCLUDED.model_version,
            provider = EXCLUDED.provider,
            status = EXCLUDED.status,
            sha256_hash = EXCLUDED.sha256_hash,
            benchmark_scores = EXCLUDED.benchmark_scores,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
      `,
      [
        entry.modelId,
        entry.modelName,
        entry.modelVersion,
        entry.provider || 'local',
        entry.status || 'active',
        entry.sha256Hash || null,
        JSON.stringify(Array.isArray(entry.benchmarkScores) ? entry.benchmarkScores : []),
        JSON.stringify(entry.metadata || {}),
      ],
    );
  }

  async logPromptAudit(
    tenantDb: DataSource,
    entry: PromptAuditLogEntry,
  ): Promise<void> {
    await this.ensureAdvancedAuditSchema(tenantDb);
    if (!entry?.promptHash || !entry?.modelId) {
      return;
    }

    await tenantDb.query(
      `
        INSERT INTO prompt_audit_log (
          prompt_hash,
          template_version,
          model_id,
          session_id,
          patient_id,
          encounter_id,
          actor_id,
          actor_role,
          input_token_count,
          output_token_count,
          latency_ms,
          safety_gate_triggered,
          request_id,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
        )
      `,
      [
        entry.promptHash,
        entry.templateVersion || 'v1',
        entry.modelId,
        entry.sessionId || null,
        entry.patientId || null,
        entry.encounterId || null,
        entry.actorId || null,
        entry.actorRole || null,
        Number(entry.inputTokenCount || 0),
        Number(entry.outputTokenCount || 0),
        Number(entry.latencyMs || 0),
        entry.safetyGateTriggered === true,
        entry.requestId || null,
        JSON.stringify(entry.metadata || {}),
      ],
    );
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    tenantDb: DataSource,
    filters: {
      userId?: string;
      patientId?: string;
      action?: HipaaAuditAction | string;
      resourceType?: string;
      outcome?: 'success' | 'failure' | 'denied';
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: any[]; total: number }> {
    await this.ensureAdvancedAuditSchema(tenantDb);

    const params: any[] = [];
    const conditions: string[] = [];

    if (filters.userId) {
      params.push(filters.userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (filters.patientId) {
      params.push(filters.patientId);
      conditions.push(`patient_id = $${params.length}`);
    }

    if (filters.action) {
      params.push(filters.action);
      conditions.push(`action = $${params.length}`);
    }

    if (filters.resourceType) {
      params.push(filters.resourceType);
      conditions.push(`resource_type = $${params.length}`);
    }

    if (filters.outcome) {
      params.push(filters.outcome);
      conditions.push(`outcome = $${params.length}`);
    }

    if (filters.riskLevel) {
      params.push(filters.riskLevel);
      conditions.push(`risk_level = $${params.length}`);
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const [logs, countResult] = await Promise.all([
      tenantDb.query(
        `
        SELECT *
        FROM hipaa_audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
        [...params, limit, offset],
      ),
      tenantDb.query(
        `
        SELECT COUNT(*)::int AS total
        FROM hipaa_audit_logs
        ${whereClause}
      `,
        params,
      ),
    ]);

    return {
      logs: logs.map(this.formatAuditLog),
      total: countResult[0]?.total || 0,
    };
  }

  /**
   * Get audit summary for compliance reporting
   */
  async getAuditSummary(
    tenantDb: DataSource,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    await this.ensureAdvancedAuditSchema(tenantDb);

    const [summary] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(DISTINCT user_id)::int AS unique_users,
        COUNT(DISTINCT patient_id)::int AS unique_patients,
        COUNT(*) FILTER (WHERE outcome = 'denied')::int AS denied_access,
        COUNT(*) FILTER (WHERE outcome = 'failure')::int AS failed_attempts,
        COUNT(*) FILTER (WHERE risk_level = 'critical')::int AS critical_events,
        COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high_risk_events,
        COUNT(*) FILTER (WHERE action = 'data_export')::int AS data_exports,
        COUNT(*) FILTER (WHERE action LIKE '%_view')::int AS phi_accesses,
        COUNT(*) FILTER (WHERE action LIKE '%_create' OR action LIKE '%_update' OR action LIKE '%_delete')::int AS phi_modifications
      FROM hipaa_audit_logs
      WHERE created_at >= $1 AND created_at <= $2
    `,
      [startDate, endDate],
    );

    const byAction = await tenantDb.query(
      `
      SELECT action, COUNT(*)::int AS count
      FROM hipaa_audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY action
      ORDER BY count DESC
      LIMIT 20
    `,
      [startDate, endDate],
    );

    const byUser = await tenantDb.query(
      `
      SELECT
        hal.user_id,
        COALESCE(hal.user_name, tu.first_name || ' ' || tu.last_name, tu.email, CASE WHEN hal.user_id IS NOT NULL AND hal.user_id != 'anonymous' THEN 'User ' || substring(hal.user_id::text, 1, 8) ELSE 'Anonymous' END) AS user_name,
        hal.user_role,
        COUNT(*)::int AS count
      FROM hipaa_audit_logs hal
      LEFT JOIN users tu ON tu.id = hal.user_id
      WHERE hal.created_at >= $1 AND hal.created_at <= $2
      GROUP BY hal.user_id, hal.user_name, tu.first_name, tu.last_name, tu.email, hal.user_role
      ORDER BY count DESC
      LIMIT 20
    `,
      [startDate, endDate],
    );

    return {
      period: { startDate, endDate },
      summary: summary[0] || {},
      byAction,
      byUser,
    };
  }

  /**
   * Detect potential breaches
   */
  async detectBreaches(tenantDb: DataSource, lookbackDays: number = 30): Promise<any[]> {
    await this.ensureAdvancedAuditSchema(tenantDb);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    // Detect suspicious patterns
    const breaches = await tenantDb.query(
      `
      WITH suspicious_patterns AS (
        SELECT
          user_id,
          user_name,
          COUNT(*)::int AS access_count,
          COUNT(DISTINCT patient_id)::int AS patient_count,
          MAX(created_at) AS last_access
        FROM hipaa_audit_logs
        WHERE created_at >= $1
          AND action LIKE '%_view'
          AND outcome = 'success'
        GROUP BY user_id, user_name
        HAVING COUNT(*) > 1000 OR COUNT(DISTINCT patient_id) > 100
      ),
      failed_accesses AS (
        SELECT
          user_id,
          COUNT(*)::int AS failed_count
        FROM hipaa_audit_logs
        WHERE created_at >= $1
          AND outcome IN ('failure', 'denied')
        GROUP BY user_id
        HAVING COUNT(*) > 10
      ),
      bulk_exports AS (
        SELECT
          user_id,
          user_name,
          COUNT(*)::int AS export_count,
          SUM((data_accessed->>'recordCount')::int) AS total_records
        FROM hipaa_audit_logs
        WHERE created_at >= $1
          AND action = 'data_export'
        GROUP BY user_id, user_name
        HAVING SUM((data_accessed->>'recordCount')::int) > 500
      )
      SELECT
        'excessive_access' AS "type",
        'high' AS "severity",
        sp.user_id AS "userId",
        COALESCE(sp.user_name, tu.first_name || ' ' || tu.last_name, 'Unknown User') AS "userName",
        sp.access_count AS "metricValue",
        sp.last_access AS "detectedAt",
        'User accessed ' || sp.access_count || ' records across ' || sp.patient_count || ' patients' AS description
      FROM suspicious_patterns sp
      LEFT JOIN users tu ON tu.id = sp.user_id
      UNION ALL
      SELECT
        'failed_access_attempts' AS "type",
        'medium' AS "severity",
        fa.user_id AS "userId",
        COALESCE(MAX(hal.user_name), MAX(tu.first_name || ' ' || tu.last_name), 'Unknown User') AS "userName",
        fa.failed_count AS "metricValue",
        MAX(hal.created_at) AS "detectedAt",
        'User had ' || fa.failed_count || ' failed access attempts' AS description
      FROM failed_accesses fa
      JOIN hipaa_audit_logs hal ON hal.user_id = fa.user_id
      LEFT JOIN users tu ON tu.id = fa.user_id
      WHERE hal.outcome IN ('failure', 'denied')
      GROUP BY fa.user_id, fa.failed_count
      UNION ALL
      SELECT
        'bulk_data_export' AS "type",
        'critical' AS "severity",
        be.user_id AS "userId",
        COALESCE(be.user_name, MAX(tu.first_name || ' ' || tu.last_name), 'Unknown User') AS "userName",
        be.total_records AS "metricValue",
        MAX(hal.created_at) AS "detectedAt",
        'User exported ' || be.total_records || ' records in ' || be.export_count || ' exports' AS description
      FROM bulk_exports be
      JOIN hipaa_audit_logs hal ON hal.user_id = be.user_id
      LEFT JOIN users tu ON tu.id = be.user_id
      WHERE hal.action = 'data_export'
      GROUP BY be.user_id, be.user_name, be.total_records, be.export_count
    `,
      [cutoffDate],
    );

    return breaches;
  }

  /**
   * Get user access report for a specific patient
   */
  async getPatientAccessReport(
    tenantDb: DataSource,
    patientId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    await this.ensureAdvancedAuditSchema(tenantDb);

    const params: any[] = [patientId];
    const conditions: string[] = ['patient_id = $1'];

    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    const [accessLog, byUser, byAction] = await Promise.all([
      tenantDb.query(
        `
        SELECT *
        FROM hipaa_audit_logs
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT 100
      `,
        params,
      ),
      tenantDb.query(
        `
        SELECT
          hal.user_id,
          COALESCE(hal.user_name, tu.first_name || ' ' || tu.last_name, 'Unknown User') AS user_name,
          hal.user_role,
          COUNT(*)::int AS access_count
        FROM hipaa_audit_logs hal
        LEFT JOIN users tu ON tu.id = hal.user_id
        WHERE ${conditions
          .map((c) => c.replace('patient_id', 'hal.patient_id').replace('created_at', 'hal.created_at'))
          .join(' AND ')}
        GROUP BY hal.user_id, hal.user_name, tu.first_name, tu.last_name, hal.user_role
        ORDER BY access_count DESC
      `,
        params,
      ),
      tenantDb.query(
        `
        SELECT action, COUNT(*)::int AS count
        FROM hipaa_audit_logs
        WHERE ${conditions.join(' AND ')}
        GROUP BY action
        ORDER BY count DESC
      `,
        params,
      ),
    ]);

    return {
      patientId,
      period: { startDate, endDate },
      totalAccesses: accessLog.length,
      byUser,
      byAction,
      recentAccess: accessLog.slice(0, 20).map(this.formatAuditLog),
    };
  }

  async getDisclosureReport(
    tenantDb: DataSource,
    patientId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    await this.ensureAdvancedAuditSchema(tenantDb);
    const params: any[] = [patientId];
    const conditions: string[] = ['hal.patient_id = $1'];

    if (startDate) {
      params.push(startDate);
      conditions.push(`hal.created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`hal.created_at <= $${params.length}`);
    }

    const [patientRows, events, summaryRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, first_name, last_name, patient_number
          FROM patients
          WHERE id = $1
          LIMIT 1
        `,
        [patientId],
      ),
      tenantDb.query(
        `
          SELECT
            hal.id,
            hal.created_at,
            hal.event_type,
            hal.operation,
            hal.data_classification,
            hal.action,
            hal.resource_type,
            hal.resource_id,
            hal.outcome,
            hal.reason,
            hal.request_id,
            hal.user_id,
            COALESCE(hal.user_name, tu.first_name || ' ' || tu.last_name, tu.email, 'Unknown User') AS actor_name,
            hal.user_role,
            hal.metadata
          FROM hipaa_audit_logs hal
          LEFT JOIN users tu ON tu.id = hal.user_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY hal.created_at DESC
          LIMIT 5000
        `,
        params,
      ),
      tenantDb.query(
        `
          SELECT
            COUNT(*)::int AS total_events,
            COUNT(*) FILTER (WHERE operation = 'READ')::int AS read_events,
            COUNT(*) FILTER (WHERE operation = 'WRITE')::int AS write_events,
            COUNT(*) FILTER (WHERE operation = 'DELETE')::int AS delete_events,
            COUNT(*) FILTER (WHERE operation = 'EXPORT')::int AS export_events,
            COUNT(*) FILTER (WHERE operation = 'SHARE')::int AS share_events,
            COUNT(*) FILTER (WHERE outcome = 'denied')::int AS denied_events
          FROM hipaa_audit_logs hal
          WHERE ${conditions.join(' AND ')}
        `,
        params,
      ),
    ]);

    const patient = patientRows?.[0];
    return {
      reportType: 'hipaa_accounting_of_disclosures',
      generatedAt: new Date().toISOString(),
      patient: patient
        ? {
            id: patient.id,
            firstName: patient.first_name,
            lastName: patient.last_name,
            patientNumber: patient.patient_number,
          }
        : {
            id: patientId,
          },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: summaryRows?.[0] || {
        total_events: 0,
        read_events: 0,
        write_events: 0,
        delete_events: 0,
        export_events: 0,
        share_events: 0,
        denied_events: 0,
      },
      events: events.map((row: any) => ({
        id: row.id,
        timestamp: row.created_at,
        eventType: row.event_type || null,
        operation: row.operation || null,
        dataClassification: row.data_classification || null,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id || null,
        outcome: row.outcome,
        reason: row.reason || null,
        requestId: row.request_id || null,
        actor: {
          id: row.user_id || null,
          name: row.actor_name || 'Unknown User',
          role: row.user_role || null,
        },
        metadata: row.metadata || {},
      })),
    };
  }

  // ========== Helper Methods ==========

  private mapOperation(action: HipaaAuditAction): 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'PRINT' | 'SHARE' {
    const raw = String(action || '').toLowerCase();
    if (raw.includes('export')) return 'EXPORT';
    if (raw.includes('print')) return 'PRINT';
    if (raw.includes('share')) return 'SHARE';
    if (raw.includes('_delete')) return 'DELETE';
    if (
      raw.includes('_create') ||
      raw.includes('_update') ||
      raw.includes('change') ||
      raw.includes('resolve') ||
      raw.includes('report')
    ) {
      return 'WRITE';
    }
    return 'READ';
  }

  private mapDataClassification(
    resourceType: string,
    operation: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'PRINT' | 'SHARE',
  ): 'PHI' | 'CLINICAL' | 'BILLING' | 'ADMIN' {
    const normalizedResource = String(resourceType || '').toLowerCase();
    if (
      normalizedResource.includes('billing') ||
      normalizedResource.includes('claim') ||
      normalizedResource.includes('invoice') ||
      normalizedResource.includes('payment')
    ) {
      return 'BILLING';
    }
    if (
      normalizedResource.includes('authentication') ||
      normalizedResource.includes('admin') ||
      normalizedResource.includes('system')
    ) {
      return 'ADMIN';
    }
    if (operation === 'READ' || operation === 'EXPORT' || operation === 'PRINT' || operation === 'SHARE') {
      return 'PHI';
    }
    return 'CLINICAL';
  }

  private mapEventType(
    action: HipaaAuditAction,
    operation: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'PRINT' | 'SHARE',
    outcome: 'success' | 'failure' | 'denied',
  ): string {
    if (outcome === 'denied' || outcome === 'failure') {
      return 'AUTH_FAILURE';
    }
    if (action === HipaaAuditAction.DATA_EXPORT || operation === 'EXPORT') {
      return 'PHI_EXPORT';
    }
    if (operation === 'READ') return 'PHI_READ';
    if (operation === 'WRITE') return 'PHI_WRITE';
    if (operation === 'DELETE') return 'PHI_DELETE';
    if (operation === 'PRINT') return 'PHI_PRINT';
    if (operation === 'SHARE') return 'PHI_SHARE';
    return 'PHI_ACCESS';
  }

  private hashIpAddress(ipAddress?: string): string | null {
    const normalizedIp = String(ipAddress || '').trim();
    if (!normalizedIp) {
      return null;
    }
    const salt = String(process.env.HIPAA_AUDIT_IP_HASH_SALT || 'medicore-hipaa-audit-salt-v1');
    return createHash('sha256').update(`${salt}:${normalizedIp}`).digest('hex');
  }

  private buildChangesDelta(oldValues?: any, newValues?: any): Array<{ op: 'add' | 'remove' | 'replace'; path: string; value?: any }> | null {
    if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object') {
      return null;
    }
    const oldObject = oldValues as Record<string, any>;
    const newObject = newValues as Record<string, any>;
    const patch: Array<{ op: 'add' | 'remove' | 'replace'; path: string; value?: any }> = [];
    const keys = new Set<string>([...Object.keys(oldObject), ...Object.keys(newObject)]);

    for (const key of keys) {
      const oldExists = Object.prototype.hasOwnProperty.call(oldObject, key);
      const newExists = Object.prototype.hasOwnProperty.call(newObject, key);
      const path = `/${String(key).replace(/\//g, '~1')}`;

      if (!oldExists && newExists) {
        patch.push({ op: 'add', path, value: newObject[key] });
        continue;
      }
      if (oldExists && !newExists) {
        patch.push({ op: 'remove', path });
        continue;
      }
      if (JSON.stringify(oldObject[key]) !== JSON.stringify(newObject[key])) {
        patch.push({ op: 'replace', path, value: newObject[key] });
      }
    }

    return patch.length ? patch : null;
  }

  private async upsertAuditIntegrityForDate(
    tenantDb: DataSource,
    at: Date,
    generatedBy?: string | null,
  ): Promise<void> {
    const auditDate = new Date(at);
    const auditDateIso = `${auditDate.getUTCFullYear()}-${String(auditDate.getUTCMonth() + 1).padStart(2, '0')}-${String(auditDate.getUTCDate()).padStart(2, '0')}`;

    const hashRows = await tenantDb.query(
      `
        WITH ordered AS (
          SELECT id, created_at, action, resource_type, patient_id, outcome, request_id
          FROM hipaa_audit_logs
          WHERE created_at::date = $1::date
          ORDER BY created_at ASC, id ASC
        )
        SELECT
          COUNT(*)::int AS event_count,
          encode(
            digest(
              COALESCE(string_agg(
                id::text || '|' ||
                created_at::text || '|' ||
                COALESCE(action, '') || '|' ||
                COALESCE(resource_type, '') || '|' ||
                COALESCE(patient_id::text, '') || '|' ||
                COALESCE(outcome, '') || '|' ||
                COALESCE(request_id, ''),
                '||'
              ), ''),
              'sha256'
            ),
            'hex'
          ) AS merkle_root_hash
        FROM ordered
      `,
      [auditDateIso],
    );

    const row = hashRows?.[0] || {};
    const eventCount = Number(row.event_count || 0);
    const merkleRootHash = String(row.merkle_root_hash || '').trim();
    if (!merkleRootHash) {
      return;
    }

    await tenantDb.query(
      `
        INSERT INTO audit_integrity_log (
          audit_date,
          event_count,
          merkle_root_hash,
          generated_at,
          generated_by,
          metadata
        )
        VALUES ($1::date, $2, $3, NOW(), $4, $5::jsonb)
        ON CONFLICT (audit_date) DO UPDATE
        SET event_count = EXCLUDED.event_count,
            merkle_root_hash = EXCLUDED.merkle_root_hash,
            generated_at = NOW(),
            generated_by = EXCLUDED.generated_by,
            metadata = EXCLUDED.metadata
      `,
      [
        auditDateIso,
        eventCount,
        merkleRootHash,
        generatedBy || null,
        JSON.stringify({
          source: 'hipaa_audit_service_auto_snapshot',
        }),
      ],
    );
  }

  private calculateRiskLevel(action: HipaaAuditAction, recordCount?: number): 'low' | 'medium' | 'high' | 'critical' {
    // High-risk actions
    if (
      action === HipaaAuditAction.DATA_EXPORT ||
      action === HipaaAuditAction.PATIENT_DELETE ||
      action === HipaaAuditAction.MEDICAL_RECORD_DELETE ||
      action === HipaaAuditAction.UNAUTHORIZED_ACCESS
    ) {
      return recordCount && recordCount > 100 ? 'critical' : 'high';
    }

    // Bulk access
    if (recordCount && recordCount > 50) {
      return 'high';
    }

    if (recordCount && recordCount > 10) {
      return 'medium';
    }

    if (
      action === HipaaAuditAction.CDSS_TRIAGE_ANALYZE ||
      action === HipaaAuditAction.CDSS_VITALS_INTERPRET ||
      action === HipaaAuditAction.CDSS_NOTES_DRAFT ||
      action === HipaaAuditAction.CDSS_HANDOFF_SUMMARY ||
      action === HipaaAuditAction.CDSS_GUIDELINES_SEARCH ||
      action === HipaaAuditAction.NURSE_TASK_COMPLETE ||
      action === HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE ||
      action === HipaaAuditAction.NURSE_HANDOFF_FINALIZE ||
      action === HipaaAuditAction.NURSE_HANDOFF_REVIEW_CONFIRM ||
      action === HipaaAuditAction.NURSE_HANDOFF_SHARE ||
      action === HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE ||
      action === HipaaAuditAction.NURSE_CROSS_MODULE_COMPLETE
    ) {
      return 'medium';
    }

    // Modification actions are medium risk
    if (action.includes('_create') || action.includes('_update') || action.includes('_delete')) {
      return 'medium';
    }

    // View actions are generally low risk
    return 'low';
  }

  private formatAuditLog(log: any): any {
    return {
      id: log.id,
      userId: log.user_id,
      userName: log.user_name,
      userRole: log.user_role,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      patientId: log.patient_id,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      sessionId: log.session_id,
      outcome: log.outcome,
      reason: log.reason,
      dataAccessed: log.data_accessed,
      oldValues: log.old_values,
      newValues: log.new_values,
      metadata: log.metadata,
      riskLevel: log.risk_level,
      eventType: log.event_type || null,
      operation: log.operation || null,
      dataClassification: log.data_classification || null,
      requestId: log.request_id || null,
      ipAddressHash: log.ip_address_hash || null,
      changesDelta: log.changes_delta || null,
      immutable: log.immutable !== false,
      createdAt: log.created_at,
    };
  }
}
