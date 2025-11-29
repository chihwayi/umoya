import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

@Injectable()
export class HipaaAuditService {
  private readonly logger = new Logger(HipaaAuditService.name);

  /**
   * Log HIPAA-compliant audit event
   */
  async logAuditEvent(
    tenantDb: DataSource,
    entry: HipaaAuditLogEntry,
  ): Promise<void> {
    try {
      // Skip logging if userId is 'anonymous' (not a valid UUID)
      // This happens for unauthenticated requests
      if (entry.userId === 'anonymous' || !entry.userId || entry.userId === 'undefined') {
        return; // Silently skip anonymous/unauthenticated requests
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(entry.userId)) {
        this.logger.debug(`Skipping audit log for non-UUID user: ${entry.userId}`);
        return;
      }

      await tenantDb.query(
        `
        INSERT INTO hipaa_audit_logs (
          user_id, user_name, user_role, action, resource_type, resource_id,
          patient_id, ip_address, user_agent, session_id, outcome, reason,
          data_accessed, old_values, new_values, metadata, risk_level, created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18
        )
      `,
        [
          entry.userId,
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
        ],
      );
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
    resourceId: string,
    patientId: string,
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
      resourceId,
      patientId,
      ipAddress,
      userAgent,
      sessionId,
      outcome: 'success',
      oldValues,
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
      SELECT user_id, user_name, user_role, COUNT(*)::int AS count
      FROM hipaa_audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY user_id, user_name, user_role
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
        'excessive_access' AS breach_type,
        sp.user_id,
        sp.user_name,
        sp.access_count AS metric_value,
        sp.last_access AS detected_at,
        'User accessed ' || sp.access_count || ' records across ' || sp.patient_count || ' patients' AS description
      FROM suspicious_patterns sp
      UNION ALL
      SELECT
        'failed_access_attempts' AS breach_type,
        fa.user_id,
        NULL AS user_name,
        fa.failed_count AS metric_value,
        MAX(hal.created_at) AS detected_at,
        'User had ' || fa.failed_count || ' failed access attempts' AS description
      FROM failed_accesses fa
      JOIN hipaa_audit_logs hal ON hal.user_id = fa.user_id
      WHERE hal.outcome IN ('failure', 'denied')
      GROUP BY fa.user_id, fa.failed_count
      UNION ALL
      SELECT
        'bulk_data_export' AS breach_type,
        be.user_id,
        be.user_name,
        be.total_records AS metric_value,
        MAX(hal.created_at) AS detected_at,
        'User exported ' || be.total_records || ' records in ' || be.export_count || ' exports' AS description
      FROM bulk_exports be
      JOIN hipaa_audit_logs hal ON hal.user_id = be.user_id
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
        SELECT user_id, user_name, user_role, COUNT(*)::int AS access_count
        FROM hipaa_audit_logs
        WHERE ${conditions.join(' AND ')}
        GROUP BY user_id, user_name, user_role
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

  // ========== Helper Methods ==========

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
      createdAt: log.created_at,
    };
  }
}


