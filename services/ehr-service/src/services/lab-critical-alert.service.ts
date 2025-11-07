import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class LabCriticalAlertService {
  private readonly logger = new Logger(LabCriticalAlertService.name);

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
        AND lca.alert_status = 'pending'
      ORDER BY lca.created_at DESC
      `,
      [userId],
    );

    return { alerts, total: alerts.length };
  }

  async getPendingAlerts(tenantDb: DataSource) {
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
      WHERE lca.alert_status = 'pending'
      ORDER BY lca.severity DESC, lca.created_at ASC
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

  async acknowledgeAlert(
    tenantDb: DataSource,
    alertId: string,
    userId: string,
    acknowledgmentNotes?: string,
  ) {
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
      [userId, acknowledgmentNotes, alertId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`);
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

    return stats[0];
  }

  // Background task to auto-escalate unacknowledged alerts
  async autoEscalateUnacknowledgedAlerts(tenantDb: DataSource, escalationThresholdMinutes = 30) {
    const unacknowledged = await tenantDb.query(
      `
      SELECT 
        lca.id,
        lca.alerted_to,
        u.role,
        sup.id as supervisor_id
      FROM lab_critical_alerts lca
      INNER JOIN users u ON u.id = lca.alerted_to
      LEFT JOIN users sup ON sup.role IN ('admin', 'doctor') AND sup.id != lca.alerted_to
      WHERE lca.alert_status = 'pending'
        AND lca.alerted_at < NOW() - INTERVAL '${escalationThresholdMinutes} minutes'
      LIMIT 10
      `,
    );

    let escalatedCount = 0;
    for (const alert of unacknowledged) {
      if (alert.supervisor_id) {
        await this.escalateAlert(tenantDb, alert.id, alert.supervisor_id, 'system');
        escalatedCount++;
      }
    }

    if (escalatedCount > 0) {
      this.logger.warn(`Auto-escalated ${escalatedCount} unacknowledged alerts`);
    }

    return { escalated: escalatedCount };
  }
}

