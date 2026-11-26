import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// R3 / FX-018 (UX-002, UX-003): acknowledging a critical result is a clinical
// act. Only the ordering clinician or an on-duty covering clinician for that
// patient/ward may acknowledge — everyone else (receptionists included) gets
// a 403, the same pattern R2 used for its role gates. Unacknowledged alerts
// escalate on a timer to whoever is actually covering (on-call roster via
// staff_duty_shifts), and escalated-but-unacknowledged alerts stay visible
// instead of silently expiring.
export interface CriticalAlertAccessor {
  userId: string;
  role: string;
}

/** Roles permitted to acknowledge/escalate critical results. */
const CRITICAL_ACK_ROLES = new Set(['doctor', 'admin', 'nurse', 'clinical_officer']);

@Injectable()
export class LabCriticalAlertService {
  private readonly logger = new Logger(LabCriticalAlertService.name);

  private isMissingSchemaError(error: any): boolean {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    return code === '42P01' || code === '42703' || message.includes('does not exist');
  }

  private async hasTable(tenantDb: DataSource, tableName: string): Promise<boolean> {
    try {
      const result = await tenantDb.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists
        `,
        [tableName],
      );
      return !!result[0]?.exists;
    } catch (error: any) {
      this.logger.warn(`Failed table existence check for ${tableName}: ${error.message}`);
      return false;
    }
  }

  private getDefaultAlertStats() {
    return {
      pending_count: 0,
      acknowledged_count: 0,
      escalated_count: 0,
      critical_count: 0,
      panic_count: 0,
      overdue_count: 0,
      avg_acknowledgment_time_minutes: 0,
    };
  }

  async getAllAlerts(tenantDb: DataSource, filters: { status?: string; severity?: string } = {}) {
    const query = `
      SELECT 
        lca.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        u.first_name || ' ' || u.last_name as alerted_to_name,
        ack_u.first_name || ' ' || ack_u.last_name as acknowledged_by_name
      FROM lab_critical_alerts lca
      INNER JOIN patients p ON p.id = lca.patient_id
      LEFT JOIN users u ON u.id = lca.alerted_to
      LEFT JOIN users ack_u ON ack_u.id = lca.acknowledged_by
      WHERE 1=1
        ${filters.status ? `AND lca.alert_status = $1` : ''}
        ${filters.severity ? `AND lca.severity = $${filters.status ? 2 : 1}` : ''}
      ORDER BY lca.created_at DESC
      LIMIT 100
    `;

    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.severity) params.push(filters.severity);

    const alerts = await tenantDb.query(query, params);
    return { alerts, total: alerts.length };
  }

  async getAlertsForUser(tenantDb: DataSource, userId: string) {
    const alerts = await tenantDb.query(
      `
      SELECT
        lca.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number
      FROM lab_critical_alerts lca
      INNER JOIN patients p ON p.id = lca.patient_id
      WHERE lca.alerted_to = $1
        AND lca.alert_status IN ('pending', 'escalated')
        AND lca.acknowledged_at IS NULL
      ORDER BY lca.created_at DESC
      `,
      [userId],
    );

    return { alerts, total: alerts.length };
  }

  async getPendingAlerts(tenantDb: DataSource) {
    // FX-018: escalated-but-unacknowledged alerts re-surface here instead of
    // silently expiring from view. Acknowledged alerts never appear.
    const alerts = await tenantDb.query(
      `
      SELECT
        lca.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.gender,
        p.date_of_birth,
        u.first_name || ' ' || u.last_name as alerted_to_name,
        EXTRACT(EPOCH FROM (NOW() - lca.alerted_at))/60 as minutes_pending
      FROM lab_critical_alerts lca
      INNER JOIN patients p ON p.id = lca.patient_id
      LEFT JOIN users u ON u.id = lca.alerted_to
      WHERE lca.alert_status IN ('pending', 'escalated')
        AND lca.acknowledged_at IS NULL
      ORDER BY
        CASE WHEN lca.alert_status = 'escalated' THEN 0 ELSE 1 END,
        lca.severity DESC, lca.created_at ASC
      `,
    );

    return { alerts, total: alerts.length };
  }

  async getPatientAlerts(tenantDb: DataSource, patientId: string) {
    const alerts = await tenantDb.query(
      `
      SELECT 
        lca.*,
        u.first_name || ' ' || u.last_name as alerted_to_name,
        ack_u.first_name || ' ' || ack_u.last_name as acknowledged_by_name
      FROM lab_critical_alerts lca
      LEFT JOIN users u ON u.id = lca.alerted_to
      LEFT JOIN users ack_u ON ack_u.id = lca.acknowledged_by
      WHERE lca.patient_id = $1
      ORDER BY lca.created_at DESC
      `,
      [patientId],
    );

    return { alerts, total: alerts.length };
  }

  async getAlertById(tenantDb: DataSource, alertId: string) {
    const alert = await tenantDb.query(
      `
      SELECT 
        lca.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.gender,
        p.date_of_birth,
        u.first_name || ' ' || u.last_name as alerted_to_name,
        ack_u.first_name || ' ' || ack_u.last_name as acknowledged_by_name,
        esc_u.first_name || ' ' || esc_u.last_name as escalated_to_name
      FROM lab_critical_alerts lca
      INNER JOIN patients p ON p.id = lca.patient_id
      LEFT JOIN users u ON u.id = lca.alerted_to
      LEFT JOIN users ack_u ON ack_u.id = lca.acknowledged_by
      LEFT JOIN users esc_u ON esc_u.id = lca.escalated_to
      WHERE lca.id = $1
      `,
      [alertId],
    );

    if (alert.length === 0) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return alert[0];
  }

  async createAlert(tenantDb: DataSource, alertData: any, userId?: string) {
    const {
      patient_id,
      lab_order_id,
      component_name,
      result_value,
      critical_range,
      severity,
      alerted_to,
    } = alertData;

    const result = await tenantDb.query(
      `
      INSERT INTO lab_critical_alerts (
        patient_id, lab_order_id, component_name, result_value,
        critical_range, severity, alert_status, alerted_to, alerted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
      RETURNING *
      `,
      [patient_id, lab_order_id, component_name, result_value, critical_range, severity, alerted_to],
    );

    this.logger.log(`Created critical alert for patient ${patient_id}: ${component_name} = ${result_value}`);
    return result[0];
  }

  async checkAndGenerateAlerts(
    tenantDb: DataSource,
    labOrderId: string,
    results: any[],
    userId?: string,
  ) {
    const alerts = [];

    // Get order details with patient info
    const orderInfo = await tenantDb.query(
      `
      SELECT 
        lo.patient_id,
        lo.ordering_provider_id,
        lo.test_catalog_id,
        p.date_of_birth,
        p.gender
      FROM lab_orders lo
      INNER JOIN patients p ON p.id = lo.patient_id
      WHERE lo.id = $1
      `,
      [labOrderId],
    );

    if (orderInfo.length === 0) {
      this.logger.warn(`Lab order ${labOrderId} not found`);
      return { alerts: [], generated: 0 };
    }

    const order = orderInfo[0];

    // Calculate patient age for reference range lookup
    const patientAge = order.date_of_birth
      ? Math.floor((Date.now() - new Date(order.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // Check each result against critical values
    for (const result of results) {
      const { component_code, component_name, value, test_catalog_id } = result;

      // Skip if no numeric value
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        continue;
      }

      // Get component with critical values
      const components = await tenantDb.query(
        `
        SELECT 
          comp.*,
          rr.range_min,
          rr.range_max
        FROM lab_test_components comp
        LEFT JOIN lab_reference_ranges rr ON rr.component_id = comp.id
          AND (rr.age_min IS NULL OR rr.age_min <= $2)
          AND (rr.age_max IS NULL OR rr.age_max >= $2)
          AND (rr.gender = $3 OR rr.gender = 'all')
        WHERE comp.component_code = $1
          AND (comp.test_catalog_id = $4 OR $4 IS NULL)
        ORDER BY 
          CASE WHEN rr.gender = $3 THEN 1 ELSE 2 END,
          CASE WHEN rr.age_min IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
        `,
        [component_code, patientAge, order.gender, test_catalog_id || null],
      );

      if (components.length === 0) {
        continue;
      }

      const component = components[0];

      // Check if value is critically low or high
      let isCritical = false;
      let criticalRange = '';
      let severity = 'critical';

      if (component.critical_low && numericValue <= component.critical_low) {
        isCritical = true;
        criticalRange = `<= ${component.critical_low}`;
        severity = numericValue <= component.critical_low * 0.5 ? 'panic' : 'critical';
      } else if (component.critical_high && numericValue >= component.critical_high) {
        isCritical = true;
        criticalRange = `>= ${component.critical_high}`;
        severity = numericValue >= component.critical_high * 1.5 ? 'panic' : 'critical';
      }

      if (isCritical) {
        // Create alert
        const alert = await this.createAlert(
          tenantDb,
          {
            patient_id: order.patient_id,
            lab_order_id: labOrderId,
            component_name: component_name || component.component_name,
            result_value: `${numericValue} ${component.unit || ''}`,
            critical_range: criticalRange,
            severity,
            alerted_to: order.ordering_provider_id,
          },
          userId,
        );

        alerts.push(alert);

        this.logger.warn(
          `Critical alert generated: ${component_name} = ${numericValue} ${component.unit} (${criticalRange}) - Severity: ${severity}`,
        );
      }
    }

    return { alerts, generated: alerts.length };
  }

  private requireCriticalAccessor(accessor: CriticalAlertAccessor | undefined | null): CriticalAlertAccessor {
    if (!accessor || typeof accessor.userId !== 'string' || !accessor.userId) {
      // Lesson 1 again: no optional identity — a missing accessor denies
      // instead of bypassing the role gate.
      throw new ForbiddenException('Critical-result acknowledgment requires an authenticated accessor');
    }
    return accessor;
  }

  /**
   * Resolve the on-duty covering clinicians: users with an on-call scheduled
   * shift for today, ward-scoped when the ward is known, otherwise any
   * on-call cover. Returns user ids with their roles.
   */
  private async resolveCoveringClinicians(
    tenantDb: DataSource,
    opts?: { tenantId?: string; ward?: string | null },
  ): Promise<Array<{ userId: string; role: string; ward: string | null }>> {
    const tryWard = async (ward: string | null | undefined) => {
      const params: any[] = [];
      const conditions = [
        "sds.status = 'scheduled'",
        'sds.on_call = true',
        'sds.shift_date = CURRENT_DATE',
      ];
      if (opts?.tenantId) {
        params.push(opts.tenantId);
        conditions.push(`sds.tenant_id = $${params.length}`);
      }
      if (ward) {
        params.push(ward);
        conditions.push(`sds.ward = $${params.length}`);
      }
      const rows = await tenantDb.query(
        `SELECT sds.user_id, u.role, sds.ward
         FROM staff_duty_shifts sds
         JOIN users u ON u.id = sds.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY sds.start_time ASC`,
        params,
      );
      return (rows || []).map((r: any) => ({
        userId: r.user_id,
        role: String(r.role || ''),
        ward: r.ward ?? null,
      }));
    };

    if (opts?.ward) {
      const scoped = await tryWard(opts.ward);
      if (scoped.length > 0) return scoped;
    }
    // Fall back to any on-call cover rather than a static role list.
    return tryWard(null);
  }

  /**
   * Best-effort ward for a patient: active admission → ward location name.
   * Returns null when unknown — callers then use any-ward on-call cover.
   */
  private async resolveAlertWard(
    tenantDb: DataSource,
    patientId: string,
    wardOverride?: string | null,
  ): Promise<string | null> {
    if (wardOverride) return wardOverride;
    try {
      const admissions = await tenantDb.query(
        `SELECT ward_location_id FROM admissions
         WHERE patient_id = $1 AND status = 'active'
         ORDER BY admission_date DESC LIMIT 1`,
        [patientId],
      );
      const locationId = admissions?.[0]?.ward_location_id;
      if (!locationId) return null;
      const locations = await tenantDb.query(
        `SELECT name FROM inventory_locations WHERE id = $1 LIMIT 1`,
        [locationId],
      );
      return locations?.[0]?.name ?? null;
    } catch (e: any) {
      this.logger.warn(`Ward resolution failed closed to any-ward cover: ${e?.message}`);
      return null;
    }
  }

  async acknowledgeAlert(
    tenantDb: DataSource,
    alertId: string,
    accessor: CriticalAlertAccessor,
    acknowledgmentNotes?: string,
    opts?: { tenantId?: string; ward?: string },
  ) {
    const acc = this.requireCriticalAccessor(accessor);
    const rows = await tenantDb.query(
      `SELECT * FROM lab_critical_alerts WHERE id = $1`,
      [alertId],
    );
    const alert = rows?.[0];
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }
    if (alert.acknowledged_at || alert.alert_status === 'acknowledged') {
      return alert; // idempotent: already acknowledged
    }

    let orderingProviderId: string | null = null;
    if (alert.lab_order_id) {
      const orders = await tenantDb.query(
        `SELECT ordering_provider_id FROM lab_orders WHERE id = $1`,
        [alert.lab_order_id],
      );
      orderingProviderId = orders?.[0]?.ordering_provider_id ?? null;
    }

    const isOrderer =
      Boolean(orderingProviderId) &&
      orderingProviderId === acc.userId &&
      CRITICAL_ACK_ROLES.has(String(acc.role));

    let isCovering = false;
    if (!isOrderer) {
      const ward = await this.resolveAlertWard(tenantDb, alert.patient_id, opts?.ward);
      const covering = await this.resolveCoveringClinicians(tenantDb, {
        tenantId: opts?.tenantId,
        ward,
      });
      isCovering =
        CRITICAL_ACK_ROLES.has(String(acc.role)) &&
        covering.some((c) => c.userId === acc.userId);
    }

    if (!isOrderer && !isCovering) {
      throw new ForbiddenException(
        'Only the ordering clinician or the on-duty covering clinician may acknowledge a critical result',
      );
    }

    const result = await tenantDb.query(
      `
      UPDATE lab_critical_alerts
      SET
        alert_status = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = NOW(),
        acknowledgment_notes = $2
      WHERE id = $3
      RETURNING *
      `,
      [acc.userId, acknowledgmentNotes, alertId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    this.logger.log(`Alert ${alertId} acknowledged by user ${acc.userId}`);
    return result[0];
  }

  async escalateAlert(tenantDb: DataSource, alertId: string, escalateToUserId: string, userId: string) {
    const result = await tenantDb.query(
      `
      UPDATE lab_critical_alerts
      SET 
        alert_status = 'escalated',
        escalated_to = $1,
        escalated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [escalateToUserId, alertId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    this.logger.warn(`Alert ${alertId} escalated to user ${escalateToUserId} by ${userId}`);
    return result[0];
  }

  async getAlertStats(tenantDb: DataSource) {
    const hasAlertsTable = await this.hasTable(tenantDb, 'lab_critical_alerts');
    if (!hasAlertsTable) {
      this.logger.warn('lab_critical_alerts table missing; returning default lab critical stats');
      return this.getDefaultAlertStats();
    }

    try {
      const stats = await tenantDb.query(
        `
        SELECT 
          COUNT(*) FILTER (WHERE alert_status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE alert_status = 'acknowledged') as acknowledged_count,
          COUNT(*) FILTER (WHERE alert_status = 'escalated') as escalated_count,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'panic') as panic_count,
          COUNT(*) FILTER (WHERE alert_status = 'pending' AND alerted_at < NOW() - INTERVAL '30 minutes') as overdue_count,
          AVG(EXTRACT(EPOCH FROM (acknowledged_at - alerted_at))/60) FILTER (WHERE acknowledged_at IS NOT NULL) as avg_acknowledgment_time_minutes
        FROM lab_critical_alerts
        WHERE created_at > NOW() - INTERVAL '7 days'
        `,
      );

      return stats[0] || this.getDefaultAlertStats();
    } catch (error: any) {
      if (this.isMissingSchemaError(error)) {
        this.logger.warn(`Lab critical stats fallback due to missing schema: ${error.message}`);
        return this.getDefaultAlertStats();
      }
      throw error;
    }
  }

  // Background task to auto-escalate unacknowledged alerts. Escalation goes
  // to whoever is actually covering (on-call roster, ward-scoped when known)
  // — not a static admin/doctor list. Alerts with no covering on-call stay
  // pending and are reported as unescalated, never silently dropped.
  async autoEscalateUnacknowledgedAlerts(
    tenantDb: DataSource,
    escalationThresholdMinutes = 30,
    opts?: { tenantId?: string; ward?: string },
  ) {
    const threshold = Number(escalationThresholdMinutes);
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new ForbiddenException('Escalation threshold must be a non-negative number');
    }
    const unacknowledged = await tenantDb.query(
      `
      SELECT
        lca.id,
        lca.patient_id,
        lca.alerted_to
      FROM lab_critical_alerts lca
      WHERE lca.alert_status = 'pending'
        AND lca.acknowledged_at IS NULL
        AND lca.alerted_at < NOW() - ($1 || ' minutes')::INTERVAL
      ORDER BY lca.alerted_at ASC
      LIMIT 50
      `,
      [String(Math.floor(threshold))],
    );

    let escalatedCount = 0;
    let unescalatedCount = 0;
    for (const alert of unacknowledged || []) {
      const ward =
        (await this.resolveAlertWard(tenantDb, alert.patient_id, opts?.ward)) ?? null;
      const covering = await this.resolveCoveringClinicians(tenantDb, {
        tenantId: opts?.tenantId,
        ward: ward ?? opts?.ward ?? null,
      });
      const target =
        covering.find((c) => c.userId !== alert.alerted_to) ?? covering[0] ?? null;
      if (target) {
        await this.escalateAlert(tenantDb, alert.id, target.userId, 'system');
        escalatedCount++;
      } else {
        unescalatedCount++;
        this.logger.warn(
          `Critical alert ${alert.id} has no on-duty cover — left pending and reported, not dropped`,
        );
      }
    }

    if (escalatedCount > 0) {
      this.logger.warn(`Auto-escalated ${escalatedCount} unacknowledged alerts`);
    }

    return { escalated: escalatedCount, unescalated: unescalatedCount };
  }
}
