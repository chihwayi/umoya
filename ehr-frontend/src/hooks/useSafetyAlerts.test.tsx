import { act, renderHook, waitFor } from '@testing-library/react';
import { useSafetyAlerts } from './useSafetyAlerts';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getNurseWorklistState: jest.fn(),
    getClinicalEscalationFeed: jest.fn(),
    acknowledgeNurseAlert: jest.fn(),
    acknowledgeClinicalEscalation: jest.fn(),
  },
}));

describe('useSafetyAlerts', () => {
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

  it('generates counts from appointment-derived clinical safety alerts', async () => {
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

    const { result } = renderHook(() => useSafetyAlerts(appointments, 'nurse-1'));

    await waitFor(() => {
      expect(ehrApi.getClinicalEscalationFeed).toHaveBeenCalled();
    });

    expect(result.current.counts.active).toBeGreaterThan(0);
    expect(result.current.counts.critical).toBeGreaterThan(0); // critical BP + low O2
    expect(result.current.counts.high).toBeGreaterThan(0); // allergy + abnormal HR/temp
  });

  it('includes server escalation alerts and acknowledges them through the escalation endpoint', async () => {
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
            },
          },
        ],
      },
    });

    const { result } = renderHook(() => useSafetyAlerts([], 'nurse-1'));

    await waitFor(() => {
      expect(result.current.alerts.some((a) => a.id === 'esc-1' && a.alertType === 'escalation')).toBe(true);
    });

    expect(result.current.counts.active).toBeGreaterThanOrEqual(1);
    expect(result.current.counts.critical).toBeGreaterThanOrEqual(1);

    await act(async () => {
      await result.current.acknowledge('esc-1');
    });

    await waitFor(() => {
      expect(ehrApi.acknowledgeClinicalEscalation).toHaveBeenCalledWith('esc-1', 'token', 'kids-clinic');
    });
    expect(ehrApi.acknowledgeNurseAlert).not.toHaveBeenCalled();

    // Acknowledged escalation drops out of the active count.
    await waitFor(() => {
      expect(result.current.counts.active).toBe(0);
    });
  });
});
