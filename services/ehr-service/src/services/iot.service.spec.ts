import { IotService } from './iot.service';
import { IotDataIngestion } from '../entities/iot-data-ingestion.entity';
import { IotDeviceRegistration } from '../entities/iot-device-registration.entity';

describe('IotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes IoT analysis through governed CdssService and updates processed flags', async () => {
    const savedRows: any[] = [];
    const submitPatientVitals = jest.fn().mockResolvedValue({
      monitoringEvent: { id: 'rm-event-1' },
      alerts: [{ alertType: 'low_oxygen_saturation' }],
    });
    const ingestionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `reading-${savedRows.length + 1}`, ...value };
        savedRows.push(row);
        return row;
      }),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    const deviceRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'device-1',
        deviceType: 'pulse_oximeter',
        manufacturer: 'Acme Health',
        model: 'Pulse+',
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {
      getRepository: jest.fn((entity) => {
        if (entity === IotDataIngestion) {
          return ingestionRepo;
        }
        if (entity === IotDeviceRegistration) {
          return deviceRepo;
        }
        throw new Error(`Unexpected repository ${String(entity)}`);
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      analyzeIotReadings: jest.fn().mockResolvedValue({
        alerts: [{ type: 'spo2', severity: 'warning' }],
      }),
    };

    const service = new IotService(
      tenantService as any,
      cdssService as any,
      { submitPatientVitals } as any,
    );
    const result = await service.ingestData('kids-clinic', 'patient-1', 'device-1', [
      { measurementType: 'spo2', value: 91, unit: '%', measuredAt: '2026-03-24T12:00:00Z' },
    ]);

    expect(result).toEqual({
      ingested: 1,
      aiAlertCount: 1,
      monitoringEventId: 'rm-event-1',
      monitoringAlertCount: 1,
    });
    expect(cdssService.analyzeIotReadings).toHaveBeenCalledWith(
      {
        patientId: 'patient-1',
        readings: [
          {
            type: 'spo2',
            value: 91,
            unit: '%',
            at: expect.any(Date),
          },
        ],
      },
      'kids-clinic',
      tenantDb,
    );
    expect(submitPatientVitals).toHaveBeenCalledWith(
      'patient-1',
      expect.objectContaining({
        oxygenSaturation: 91,
        sourceType: 'device',
        sourceName: 'pulse_oximeter',
        sourceDeviceId: 'device-1',
        sourceDeviceType: 'pulse_oximeter',
        sourceVendor: 'Acme Health',
        sourceModel: 'Pulse+',
        verificationStatus: 'device_linked',
        measurementCount: 1,
      }),
      'kids-clinic',
    );
    expect(ingestionRepo.update).toHaveBeenCalledWith('reading-1', { aiProcessed: true, alertTriggered: true });
    expect(deviceRepo.update).toHaveBeenCalledWith('device-1', { lastSyncAt: expect.any(Date) });
  });
});
