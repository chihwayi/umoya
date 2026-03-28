import { PatientVitalsSubmissionService } from './patient-vitals-submission.service';

describe('PatientVitalsSubmissionService', () => {
  it('persists remote monitoring artifacts and returns generated alerts for patient-submitted vitals', async () => {
    const eventRows: any[] = [];
    const alertRows: any[] = [];

    const tenantDb = {
      query: jest.fn().mockResolvedValue([{ id: 'system-user-1' }]),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity.name === 'RemoteMonitoringEvent') {
          return {
            create: jest.fn().mockImplementation((payload) => payload),
            save: jest.fn().mockImplementation(async (payload) => {
              const row = { id: 'rm-event-1', ...payload };
              eventRows.push(row);
              return row;
            }),
          };
        }

        if (entity.name === 'RemoteMonitoringAlert') {
          return {
            create: jest.fn().mockImplementation((payload) => payload),
            save: jest.fn().mockImplementation(async (payload) => {
              const row = { id: `rm-alert-${alertRows.length + 1}`, ...payload };
              alertRows.push(row);
              return row;
            }),
          };
        }

        return null;
      }),
    };

    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const vitalsService = {
      recordVitals: jest.fn().mockResolvedValue({
        id: 'vitals-1',
        patientId: 'pat-1',
        cdssInsights: { review: 'ok' },
        earlyWarningAssessment: {
          id: 'ews-1',
          totalScore: 7,
          riskLevel: 'high',
          alertTriggered: true,
          explanationSummary: 'NEWS2 7 (high) driven by heartRate scored 2, spo2 scored 2.',
          escalationTaskId: 'esc-1',
        },
      }),
    };
    const patientNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };

    const service = new PatientVitalsSubmissionService(
      tenantService as any,
      vitalsService as any,
      patientNotificationsService as any,
      undefined,
    );

    const result = await service.submitPatientVitals(
      'pat-1',
      {
        bloodPressure: '186/122',
        heartRate: 128,
        oxygenSaturation: 89,
        sourceType: 'device',
        sourceName: 'home_pulse_oximeter',
        sourceDeviceId: 'device-1',
        sourceDeviceType: 'pulse_oximeter',
        sourceVendor: 'Acme Health',
        sourceModel: 'Pulse+',
        verificationStatus: 'device_linked',
        measurementCount: 3,
      },
      'kids-clinic',
    );

    expect(vitalsService.recordVitals).toHaveBeenCalled();
    expect(result.monitoringEvent.id).toBe('rm-event-1');
    expect(result.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alertType: 'hypertensive_crisis', severity: 'critical' }),
        expect.objectContaining({ alertType: 'early_warning_deterioration', severity: 'critical' }),
      ]),
    );
    expect(eventRows[0]).toEqual(
      expect.objectContaining({
        patientId: 'pat-1',
        sourceType: 'device',
        sourceName: 'home_pulse_oximeter',
        deviceId: 'device-1',
        deviceType: 'pulse_oximeter',
        sourceVendor: 'Acme Health',
        sourceModel: 'Pulse+',
        verificationStatus: 'device_linked',
        measurementCount: 3,
        alertCount: result.alerts?.length,
      }),
    );
    expect(alertRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 'rm-event-1',
          linkedEscalationTaskId: 'esc-1',
        }),
      ]),
    );
    expect(patientNotificationsService.createNotification).toHaveBeenCalled();
  });
});
