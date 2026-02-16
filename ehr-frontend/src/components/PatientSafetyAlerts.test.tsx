import React from 'react';
import { render, waitFor } from '@testing-library/react';
import PatientSafetyAlerts from './PatientSafetyAlerts';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getNurseWorklistState: jest.fn(),
    acknowledgeNurseAlert: jest.fn(),
  },
}));

describe('PatientSafetyAlerts', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token');
    localStorage.setItem('ehr_tenant_slug', 'kids-clinic');
    (ehrApi.getNurseWorklistState as jest.Mock).mockResolvedValue({
      data: { acknowledgedAlertIds: [] },
    });
  });

  it('emits alert counts from generated clinical safety alerts', async () => {
    const onAlertCountsChange = jest.fn();

    const appointments = [
      {
        id: 'apt-1',
        patient: {
          id: 'p-1',
          firstName: 'Kaylee',
          lastName: 'Dube',
          age: 72,
          allergies: 'Penicillin',
        },
        vitals: {
          bloodPressure: '190/120',
          heartRate: 130,
          temperature: 39.1,
          oxygenSaturation: 88,
        },
      },
    ];

    render(
      <PatientSafetyAlerts
        currentUser={{ id: 'nurse-1' }}
        appointments={appointments as any}
        onAlertCountsChange={onAlertCountsChange}
      />,
    );

    await waitFor(() => {
      expect(onAlertCountsChange).toHaveBeenCalled();
    });

    const latest = onAlertCountsChange.mock.calls[onAlertCountsChange.mock.calls.length - 1][0];
    expect(latest.active).toBeGreaterThan(0);
    expect(latest.critical).toBeGreaterThan(0);
    expect(latest.high).toBeGreaterThan(0);
  });
});

