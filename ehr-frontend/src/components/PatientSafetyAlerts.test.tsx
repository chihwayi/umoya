import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PatientSafetyAlerts from './PatientSafetyAlerts';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getNurseWorklistState: jest.fn(),
    getClinicalEscalationFeed: jest.fn(),
    acknowledgeNurseAlert: jest.fn(),
    acknowledgeClinicalEscalation: jest.fn(),
  },
}));

describe('PatientSafetyAlerts', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token');
    localStorage.setItem('ehr_tenant_slug', 'kids-clinic');
    (ehrApi.getNurseWorklistState as jest.Mock).mockResolvedValue({
      data: { acknowledgedAlertIds: [] },
    });
    (ehrApi.getClinicalEscalationFeed as jest.Mock).mockResolvedValue({
      data: { items: [] },
    });
    (ehrApi.acknowledgeClinicalEscalation as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (ehrApi.acknowledgeNurseAlert as jest.Mock).mockResolvedValue({ data: { ok: true } });
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

    await act(async () => {
      render(
        <PatientSafetyAlerts
          currentUser={{ id: 'nurse-1' }}
          appointments={appointments as any}
          onAlertCountsChange={onAlertCountsChange}
        />,
      );
    });

    await waitFor(() => {
      expect(onAlertCountsChange).toHaveBeenCalled();
    });

    const latest = onAlertCountsChange.mock.calls[onAlertCountsChange.mock.calls.length - 1][0];
    expect(latest.active).toBeGreaterThan(0);
    expect(latest.critical).toBeGreaterThan(0);
    expect(latest.high).toBeGreaterThan(0);
  });

  it('includes server escalation alerts and acknowledges them through the escalation endpoint', async () => {
    const onAlertCountsChange = jest.fn();
    (ehrApi.getClinicalEscalationFeed as jest.Mock).mockResolvedValue({
      data: {
        items: [
          {
            id: 'esc-1',
            patientId: 'p-1',
            patientName: 'Kaylee Dube',
            severity: 'critical',
            status: 'open',
            title: 'Escalate NEWS2 deterioration',
            summary: 'Clinical escalation requires nurse action.',
            dueAt: new Date().toISOString(),
            recommendedAction: 'Review patient now.',
            trustSummary: {
              sourceLabel: 'Early warning deterioration signal',
              backingType: 'Rule-backed safety escalation',
              reviewState: 'Pending nurse review',
              classifierStage: 'Deterioration Review',
              riskBand: 'High',
              evidenceCount: 1,
            },
          },
        ],
      },
    });

    await act(async () => {
      render(
        <PatientSafetyAlerts
          currentUser={{ id: 'nurse-1' }}
          appointments={[] as any}
          onAlertCountsChange={onAlertCountsChange}
        />,
      );
    });

    await waitFor(() => {
      expect(onAlertCountsChange).toHaveBeenCalled();
      expect(screen.queryByText('Escalate NEWS2 deterioration')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Escalate NEWS2 deterioration'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Rule-backed safety escalation/i)).not.toBeNull();
    });

    const latest = onAlertCountsChange.mock.calls[onAlertCountsChange.mock.calls.length - 1][0];
    expect(latest.active).toBeGreaterThanOrEqual(1);
    expect(latest.critical).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Acknowledge/i }));
    });

    await waitFor(() => {
      expect(ehrApi.acknowledgeClinicalEscalation).toHaveBeenCalledWith('esc-1', 'token', 'kids-clinic');
    });
    expect(ehrApi.acknowledgeNurseAlert).not.toHaveBeenCalled();
  });
});
