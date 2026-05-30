import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { flagReading, ReadingType } from '../constants/wearable-ranges';

export interface WearableReadingDto {
  deviceId?: string;
  readingType: ReadingType;
  value: number;
  unit: string;
  recordedAt: string;
  sourceRaw?: Record<string, unknown>;
}

@Injectable()
export class WearableSyncService {
  private readonly logger = new Logger(WearableSyncService.name);

  async registerDevice(
    db: DataSource,
    patientId: string,
    payload: {
      deviceType: string;
      deviceName?: string;
      bleAddress?: string;
      externalId?: string;
    },
  ): Promise<string> {
    const result = await db.query(
      `INSERT INTO wearable_devices
         (patient_id, device_type, device_name, ble_address, external_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (patient_id, device_type, external_id) DO UPDATE
         SET device_name = EXCLUDED.device_name,
             is_active   = TRUE,
             last_sync_at = now()
       RETURNING id`,
      [
        patientId,
        payload.deviceType,
        payload.deviceName ?? null,
        payload.bleAddress ?? null,
        payload.externalId ?? null,
      ],
    );
    return result[0].id as string;
  }

  async ingestReadings(
    db: DataSource,
    patientId: string,
    readings: WearableReadingDto[],
  ): Promise<{ inserted: number; flagged: number }> {
    let inserted = 0;
    let flaggedCount = 0;

    for (const r of readings) {
      const { flagged, reason } = flagReading(r.readingType, r.value);
      if (flagged) flaggedCount++;

      await db.query(
        `INSERT INTO wearable_readings
           (patient_id, device_id, reading_type, value, unit, recorded_at, is_flagged, flag_reason, source_raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        [
          patientId,
          r.deviceId ?? null,
          r.readingType,
          r.value,
          r.unit,
          r.recordedAt,
          flagged,
          reason ?? null,
          r.sourceRaw ? JSON.stringify(r.sourceRaw) : null,
        ],
      );
      inserted++;
    }

    // Update last_sync_at on all devices for this patient
    const deviceIds = [...new Set(readings.map(r => r.deviceId).filter(Boolean))];
    if (deviceIds.length > 0) {
      await db.query(
        `UPDATE wearable_devices SET last_sync_at = now() WHERE id = ANY($1::uuid[])`,
        [deviceIds],
      );
    }

    await this.checkAndFireTrendAlerts(db, patientId, readings);

    this.logger.log(`Wearable ingest: patient=${patientId} inserted=${inserted} flagged=${flaggedCount}`);
    return { inserted, flagged: flaggedCount };
  }

  private async checkAndFireTrendAlerts(
    db: DataSource,
    patientId: string,
    recent: WearableReadingDto[],
  ): Promise<void> {
    const types = [...new Set(recent.map(r => r.readingType))];

    for (const type of types) {
      const rows = await db.query(
        `SELECT is_flagged
         FROM wearable_readings
         WHERE patient_id = $1
           AND reading_type = $2
           AND recorded_at > now() - interval '24 hours'
         ORDER BY recorded_at DESC
         LIMIT 3`,
        [patientId, type],
      );

      if (rows.length === 3 && rows.every((r: any) => r.is_flagged)) {
        const level = rows.some((r: any) => r.flag_reason?.startsWith('Critical')) ? 'critical' : 'warning';
        const [existing] = await db.query(
          `SELECT id FROM wearable_trend_alerts
           WHERE patient_id = $1 AND reading_type = $2 AND acknowledged = FALSE
             AND triggered_at > now() - interval '24 hours'
           LIMIT 1`,
          [patientId, type],
        );
        if (!existing) {
          await db.query(
            `INSERT INTO wearable_trend_alerts
               (patient_id, reading_type, alert_level, message)
             VALUES ($1, $2, $3, $4)`,
            [patientId, type, level, `3 consecutive abnormal ${type} readings in last 24 h`],
          );
          this.logger.warn(`Trend alert fired: patient=${patientId} type=${type} level=${level}`);
        }
      }
    }
  }

  async getTimeline(
    db: DataSource,
    patientId: string,
    readingType: ReadingType,
    days = 7,
  ): Promise<Array<{ recorded_at: string; value: number; is_flagged: boolean }>> {
    return db.query(
      `SELECT recorded_at, value::float AS value, is_flagged
       FROM wearable_readings
       WHERE patient_id = $1
         AND reading_type = $2
         AND recorded_at > now() - ($3 || ' days')::interval
       ORDER BY recorded_at ASC`,
      [patientId, readingType, days],
    );
  }

  async listDevices(db: DataSource, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT id, device_type, device_name, ble_address, is_active, last_sync_at
       FROM wearable_devices
       WHERE patient_id = $1
       ORDER BY registered_at DESC`,
      [patientId],
    );
  }

  async getPendingAlerts(db: DataSource, patientId?: string): Promise<any[]> {
    if (patientId) {
      return db.query(
        `SELECT * FROM wearable_trend_alerts
         WHERE patient_id = $1 AND acknowledged = FALSE
         ORDER BY triggered_at DESC`,
        [patientId],
      );
    }
    return db.query(
      `SELECT * FROM wearable_trend_alerts
       WHERE acknowledged = FALSE
       ORDER BY triggered_at DESC`,
    );
  }

  async acknowledgeAlert(db: DataSource, alertId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE wearable_trend_alerts
       SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = now()
       WHERE id = $2`,
      [userId, alertId],
    );
  }
}
