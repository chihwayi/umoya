import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { IotDeviceRegistration } from '../entities/iot-device-registration.entity';
import { IotDataIngestion } from '../entities/iot-data-ingestion.entity';
import axios from 'axios';

@Injectable()
export class IotService {
  private readonly logger = new Logger(IotService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

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

  async ingestData(subdomain: string, patientId: string, deviceId: string, readings: Array<{
    measurementType: string; value: number; unit: string; measuredAt: string;
  }>) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IotDataIngestion);
    const saved: IotDataIngestion[] = [];

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

    // AI analysis (fire-and-forget)
    this.analyzeReadings(subdomain, ds, patientId, saved).catch(e =>
      this.logger.warn(`IoT analysis failed: ${e?.message}`));

    // Update device last sync
    await ds.getRepository(IotDeviceRegistration).update(deviceId, { lastSyncAt: new Date() }).catch(() => {});

    return { ingested: saved.length };
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
      const { data } = await axios.post(`${this.cdssUrl}/iot/analyze`, {
        patientId,
        readings: readings.map(r => ({ type: r.measurementType, value: r.value, unit: r.unit, at: r.measuredAt })),
      });
      if (data.alerts?.length) {
        for (const reading of readings) {
          await ds.getRepository(IotDataIngestion).update(reading.id, { aiProcessed: true, alertTriggered: true });
        }
      } else {
        for (const reading of readings) {
          await ds.getRepository(IotDataIngestion).update(reading.id, { aiProcessed: true });
        }
      }
    } catch (e: any) {
      this.logger.warn(`IoT CDSS analysis unavailable: ${e?.message}`);
    }
  }
}
