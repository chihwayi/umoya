import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { IotDeviceRegistration } from '../entities/iot-device-registration.entity';
import { IotDataIngestion } from '../entities/iot-data-ingestion.entity';
import { CdssService } from './cdss.service';
import { PatientVitalsSubmissionService } from './patient-vitals-submission.service';

interface IotReadingInput {
  measurementType: string;
  value: number;
  unit: string;
  measuredAt: string;
}

@Injectable()
export class IotService {
  private readonly logger = new Logger(IotService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly patientVitalsSubmissionService: PatientVitalsSubmissionService,
  ) {}

  // ── Device Registration ───────────────────────────────────────────────────

  async registerDevice(subdomain: string, patientId: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(IotDeviceRegistration).save(
      ds.getRepository(IotDeviceRegistration).create({ ...dto, patientId })
    );
  }

  async getDevices(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(IotDeviceRegistration).find({ where: { patientId, status: 'active' } });
  }

  async revokeDevice(subdomain: string, deviceId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IotDeviceRegistration);
    await repo.update(deviceId, { status: 'revoked' });
    return repo.findOneBy({ id: deviceId });
  }

  // ── Data Ingestion ────────────────────────────────────────────────────────

  async ingestData(subdomain: string, patientId: string, deviceId: string, readings: IotReadingInput[]) {
    if (!Array.isArray(readings) || readings.length === 0) {
      return { ingested: 0, aiAlertCount: 0, monitoringEventId: null, monitoringAlertCount: 0 };
    }

    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IotDataIngestion);
    const deviceRepo = ds.getRepository(IotDeviceRegistration);
    const saved: IotDataIngestion[] = [];
    const device = await deviceRepo.findOneBy({ id: deviceId }).catch((e: any) => { this.logger.warn(`IoT device registration fetch failed: ${e?.message}`); return null; });

    for (const r of readings) {
      const rec = await repo.save(repo.create({
        patientId, deviceId,
        measurementType: r.measurementType,
        value: r.value,
        unit: r.unit,
        measuredAt: new Date(r.measuredAt),
        ingestedAt: new Date(),
      }));
      saved.push(rec);
    }

    const [analysisResult, monitoringSync] = await Promise.all([
      this.analyzeReadings(subdomain, ds, patientId, saved),
      this.syncReadingsIntoRemoteMonitoring(subdomain, patientId, device, saved),
    ]);

    // Update device last sync
    await deviceRepo.update(deviceId, { lastSyncAt: new Date() }).catch((e: any) => { this.logger.warn(`IoT device last-sync timestamp update failed: ${e?.message}`); });

    return {
      ingested: saved.length,
      aiAlertCount: Array.isArray(analysisResult?.alerts) ? analysisResult.alerts.length : 0,
      monitoringEventId: monitoringSync?.monitoringEvent?.id ?? null,
      monitoringAlertCount: Array.isArray(monitoringSync?.alerts) ? monitoringSync.alerts.length : 0,
    };
  }

  async getReadings(subdomain: string, patientId: string, measurementType?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const qb = ds.getRepository(IotDataIngestion)
      .createQueryBuilder('r')
      .where('r.patient_id = :patientId', { patientId })
      .orderBy('r.measured_at', 'DESC')
      .limit(500);
    if (measurementType) qb.andWhere('r.measurement_type = :measurementType', { measurementType });
    return qb.getMany();
  }

  private async analyzeReadings(subdomain: string, ds: any, patientId: string, readings: IotDataIngestion[]) {
    try {
      const data = await this.cdssService.analyzeIotReadings(
        {
          patientId,
          readings: readings.map(r => ({ type: r.measurementType, value: r.value, unit: r.unit, at: r.measuredAt })),
        },
        subdomain,
        ds,
      );
      if (data.alerts?.length) {
        for (const reading of readings) {
          await ds.getRepository(IotDataIngestion).update(reading.id, { aiProcessed: true, alertTriggered: true });
        }
      } else {
        for (const reading of readings) {
          await ds.getRepository(IotDataIngestion).update(reading.id, { aiProcessed: true });
        }
      }
      return data;
    } catch (e: any) {
      this.logger.warn(`IoT CDSS analysis unavailable: ${e?.message}`);
      return null;
    }
  }

  private buildVitalsPayloadFromReadings(device: Partial<IotDeviceRegistration> | null, readings: IotDataIngestion[]) {
    const latestByType = new Map<string, IotDataIngestion>();
    for (const reading of readings) {
      const existing = latestByType.get(reading.measurementType);
      if (!existing || new Date(reading.measuredAt).getTime() >= new Date(existing.measuredAt).getTime()) {
        latestByType.set(reading.measurementType, reading);
      }
    }

    const bpSystolic = latestByType.get('bp_systolic');
    const bpDiastolic = latestByType.get('bp_diastolic');

    const payload: Record<string, any> = {
      sourceType: 'device',
      sourceName: device?.deviceType || 'iot_device',
      sourceConfidence: 0.98,
      sourceDeviceId: device?.id || readings[0]?.deviceId || null,
      sourceDeviceType: device?.deviceType || null,
      sourceVendor: device?.manufacturer || null,
      sourceModel: device?.model || null,
      verificationStatus: device ? 'device_linked' : 'device_unregistered',
      measurementCount: readings.length,
      recordedAt: readings.reduce((latest, reading) => {
        const readingAt = new Date(reading.measuredAt).toISOString();
        return readingAt > latest ? readingAt : latest;
      }, new Date(readings[0]?.measuredAt || Date.now()).toISOString()),
    };

    if (bpSystolic && bpDiastolic) {
      payload.bloodPressure = `${Math.round(Number(bpSystolic.value))}/${Math.round(Number(bpDiastolic.value))}`;
    }

    const measurementMap: Array<[string, string]> = [
      ['heart_rate', 'heartRate'],
      ['spo2', 'oxygenSaturation'],
      ['respiratory_rate', 'respiratoryRate'],
      ['temperature', 'temperature'],
      ['weight', 'weight'],
      ['height', 'height'],
      ['glucose', 'bloodGlucose'],
      ['blood_glucose', 'bloodGlucose'],
      ['pain_level', 'painLevel'],
    ];

    for (const [measurementType, field] of measurementMap) {
      const reading = latestByType.get(measurementType);
      if (reading) {
        payload[field] = Number(reading.value);
      }
    }

    const supportedFieldCount = [
      payload.bloodPressure,
      payload.heartRate,
      payload.oxygenSaturation,
      payload.respiratoryRate,
      payload.temperature,
      payload.weight,
      payload.height,
      payload.bloodGlucose,
      payload.painLevel,
    ].filter((value) => value !== undefined && value !== null).length;

    if (supportedFieldCount === 0) {
      return null;
    }

    return payload;
  }

  private async syncReadingsIntoRemoteMonitoring(
    subdomain: string,
    patientId: string,
    device: Partial<IotDeviceRegistration> | null,
    readings: IotDataIngestion[],
  ) {
    const vitalsPayload = this.buildVitalsPayloadFromReadings(device, readings);
    if (!vitalsPayload) {
      return null;
    }

    try {
      return await this.patientVitalsSubmissionService.submitPatientVitals(patientId, vitalsPayload, subdomain);
    } catch (error: any) {
      this.logger.warn(`IoT remote monitoring sync unavailable: ${error?.message}`);
      return null;
    }
  }
}
