import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateRemoteMonitoringDto,
  UpdateRemoteMonitoringDto,
  RemoteMonitoringQueryDto,
} from '../dto/telemedicine.dto';

@Injectable()
export class RemoteMonitoringService {
  private readonly logger = new Logger(RemoteMonitoringService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Record a monitoring reading
   */
  async recordReading(tenantDb: DataSource, dto: CreateRemoteMonitoringDto, userId?: string) {
    this.ensureTenantDb(tenantDb);

    // Check for alert conditions
    const alert = this.checkAlertConditions(dto.monitoringType, dto.readingValue, dto.readingUnit);

    const result = await tenantDb.query(
      `INSERT INTO remote_patient_monitoring (
        patient_id, monitoring_type, device_name, device_model,
        reading_value, reading_unit, reading_date, uploaded_by,
        device_synced, notes, alert_triggered, alert_severity,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        dto.patientId,
        dto.monitoringType,
        dto.deviceName ?? null,
        dto.deviceModel ?? null,
        dto.readingValue,
        dto.readingUnit,
        dto.readingDate ?? null,
        userId ?? null,
        dto.deviceSynced ?? false,
        dto.notes ?? null,
        alert.triggered,
        alert.severity ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Get patient readings
   */
  async getPatientReadings(tenantDb: DataSource, filters: RemoteMonitoringQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = ['patient_id = $1'];
    const params: any[] = [filters.patientId];

    if (filters.monitoringType) {
      where.push(`monitoring_type = $${params.length + 1}`);
      params.push(filters.monitoringType);
    }

    if (filters.dateFrom) {
      where.push(`reading_date >= $${params.length + 1}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      where.push(`reading_date <= $${params.length + 1}`);
      params.push(filters.dateTo);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const readings = await tenantDb.query(
      `SELECT * FROM remote_patient_monitoring
       ${whereClause}
       ORDER BY reading_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const [totalResult] = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM remote_patient_monitoring ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return {
      readings,
      total: totalResult?.count ?? readings.length,
      page,
      limit,
    };
  }

  /**
   * Get reading trends
   */
  async getReadingTrends(
    tenantDb: DataSource,
    patientId: string,
    monitoringType: string,
    period: '7d' | '30d' | '90d' | '1y' = '30d',
  ) {
    this.ensureTenantDb(tenantDb);

    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = daysMap[period];

    const trends = await tenantDb.query(
      `SELECT 
        DATE_TRUNC('day', reading_date) as date,
        AVG(reading_value) as avg_value,
        MIN(reading_value) as min_value,
        MAX(reading_value) as max_value,
        COUNT(*) as reading_count
       FROM remote_patient_monitoring
       WHERE patient_id = $1 
         AND monitoring_type = $2
         AND reading_date >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE_TRUNC('day', reading_date)
       ORDER BY date ASC`,
      [patientId, monitoringType],
    );

    return trends;
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(
    monitoringType: string,
    value: number,
    unit: string,
  ): { triggered: boolean; severity?: 'low' | 'medium' | 'high' | 'critical' } {
    // Basic alert thresholds - can be customized per patient
    switch (monitoringType) {
      case 'blood_pressure':
        // Systolic > 180 or < 90, Diastolic > 120 or < 60
        if (unit === 'mmHg') {
          if (value > 180 || value < 90) {
            return { triggered: true, severity: 'high' };
          }
        }
        break;
      case 'blood_glucose':
        // > 250 mg/dL or < 70 mg/dL
        if (unit === 'mg/dL') {
          if (value > 250 || value < 70) {
            return { triggered: true, severity: value < 70 ? 'critical' : 'high' };
          }
        }
        break;
      case 'heart_rate':
        // > 100 bpm or < 60 bpm
        if (unit === 'bpm') {
          if (value > 100 || value < 60) {
            return { triggered: true, severity: value < 50 || value > 120 ? 'high' : 'medium' };
          }
        }
        break;
      case 'oxygen_saturation':
        // < 95%
        if (unit === '%') {
          if (value < 95) {
            return { triggered: true, severity: value < 90 ? 'critical' : 'high' };
          }
        }
        break;
      case 'temperature':
        // > 38°C or < 36°C
        if (unit === 'C' || unit === '°C') {
          if (value > 38 || value < 36) {
            return { triggered: true, severity: value > 39 || value < 35 ? 'high' : 'medium' };
          }
        }
        break;
    }

    return { triggered: false };
  }

  /**
   * Get active monitoring alerts
   */
  async getActiveAlerts(tenantDb: DataSource, patientId?: string) {
    this.ensureTenantDb(tenantDb);

    const where = patientId ? 'WHERE patient_id = $1 AND alert_triggered = true' : 'WHERE alert_triggered = true';
    const params = patientId ? [patientId] : [];

    const alerts = await tenantDb.query(
      `SELECT * FROM remote_patient_monitoring
       ${where}
       ORDER BY reading_date DESC
       LIMIT 50`,
      params,
    );

    return alerts;
  }

  /**
   * Setup monitoring for a patient
   */
  async setupMonitoring(
    tenantDb: DataSource,
    patientId: string,
    config: {
      monitoringTypes: string[];
      alertThresholds?: Record<string, { min?: number; max?: number }>;
    },
  ) {
    this.ensureTenantDb(tenantDb);

    // Store monitoring configuration (could be in a separate table)
    // For now, just return success
    return {
      patientId,
      monitoringTypes: config.monitoringTypes,
      alertThresholds: config.alertThresholds,
      message: 'Monitoring setup completed',
    };
  }

  /**
   * Sync device data
   */
  async syncDeviceData(
    tenantDb: DataSource,
    patientId: string,
    deviceId: string,
    data: Array<{
      monitoringType: string;
      readingValue: number;
      readingUnit: string;
      readingDate: string;
    }>,
  ) {
    this.ensureTenantDb(tenantDb);

    const results = [];

    for (const reading of data) {
      const result = await this.recordReading(
        tenantDb,
        {
          patientId,
          monitoringType: reading.monitoringType,
          readingValue: reading.readingValue,
          readingUnit: reading.readingUnit,
          readingDate: reading.readingDate,
          deviceSynced: true,
        },
        undefined, // System sync
      );
      results.push(result);
    }

    return {
      synced: results.length,
      readings: results,
    };
  }
}

