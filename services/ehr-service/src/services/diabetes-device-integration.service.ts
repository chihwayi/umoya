import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateDeviceIntegrationDto,
  UpdateDeviceIntegrationDto,
  SyncCgmDataDto,
} from '../dto/diabetes.dto';

@Injectable()
export class DiabetesDeviceIntegrationService {
  private readonly logger = new Logger(DiabetesDeviceIntegrationService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  async registerDevice(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: CreateDeviceIntegrationDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const [device] = await tenantDb.query(
      `
        INSERT INTO diabetes_device_integration (
          diabetes_registry_id, patient_id, device_type, device_brand, device_model,
          device_serial_number, device_id, integration_type, integration_status,
          last_sync_at, sync_frequency, api_credentials_encrypted, settings,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'active'),$10,$11,$12,$13,NOW(),NOW()
        )
        RETURNING *
      `,
      [
        registryId,
        patientId,
        dto.deviceType,
        dto.deviceBrand ?? null,
        dto.deviceModel ?? null,
        dto.deviceSerialNumber ?? null,
        dto.deviceId ?? null,
        dto.integrationType ?? null,
        dto.integrationStatus ?? 'active',
        dto.lastSyncAt ?? null,
        dto.syncFrequency ?? null,
        dto.apiCredentialsEncrypted ?? null,
        dto.settings ?? {},
      ],
    );
    return device;
  }

  async listDevices(tenantDb: DataSource, registryId: string) {
    this.ensureTenantDb(tenantDb);
    return tenantDb.query(
      `SELECT * FROM diabetes_device_integration WHERE diabetes_registry_id = $1 ORDER BY updated_at DESC`,
      [registryId],
    );
  }

  async updateDevice(
    tenantDb: DataSource,
    deviceId: string,
    dto: UpdateDeviceIntegrationDto,
  ) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${this.camelToSnake(key)} = $${params.length + 1}`);
        params.push(value);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(deviceId);
    const [updated] = await tenantDb.query(
      `UPDATE diabetes_device_integration SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!updated) {
      throw new NotFoundException(`Device integration ${deviceId} not found`);
    }
    return updated;
  }

  async syncCgmData(
    tenantDb: DataSource,
    registryId: string,
    patientId: string,
    dto: SyncCgmDataDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);
    if (!dto.entries?.length) {
      throw new BadRequestException('No CGM entries provided');
    }

    let inserted = 0;
    for (const entry of dto.entries) {
      await tenantDb.query(
        `
          INSERT INTO glucose_monitoring (
            diabetes_registry_id, patient_id, monitoring_type, device_type, device_id,
            glucose_value, glucose_unit, reading_type, meal_context,
            insulin_dose, insulin_type, carbohydrates_grams, exercise_minutes,
            stress_level, notes, recorded_at, recorded_by, created_at, updated_at
          )
          VALUES (
            $1,$2,'cgm',$3,$4,$5,'mmol/L',NULL,NULL,NULL,NULL,NULL,NULL,NULL,
            $6,$7,NOW(),NOW()
          )
        `,
        [
          registryId,
          patientId,
          dto.deviceType ?? 'cgm',
          dto.deviceId ?? null,
          // CGM device payloads report glucose in mg/dL; store standardised to mmol/L.
          entry.value !== null && entry.value !== undefined
            ? Number((Number(entry.value) / 18.0182).toFixed(1))
            : entry.value,
          entry.eventType ?? entry.trend ?? null,
          entry.timestamp,
          userId ?? null,
        ],
      );
      inserted += 1;
    }

    if (dto.deviceId) {
      await tenantDb.query(
        `
          UPDATE diabetes_device_integration
          SET last_sync_at = NOW(),
              updated_at = NOW()
          WHERE diabetes_registry_id = $1 AND device_id = $2
        `,
        [registryId, dto.deviceId],
      );
    }

    this.logger.log(`Synced ${inserted} CGM entries for registry ${registryId}`);
    return { inserted };
  }

  private camelToSnake(value: string) {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}



