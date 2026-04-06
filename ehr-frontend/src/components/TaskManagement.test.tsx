import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskManagement from './TaskManagement';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getNurseWorklistState: jest.fn(),
    getClinicalEscalationFeed: jest.fn(),
    acknowledgeClinicalEscalation: jest.fn(),
    completeClinicalEscalation: jest.fn(),
    completeNurseTask: jest.fn(),
  },
  cdssApi: {
    markNurseTaskViewed: jest.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

describe('TaskManagement', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token');
    localStorage.setItem('ehr_tenant_slug', 'kids-clinic');
    (ehrApi.getNurseWorklistState as jest.Mock).mockResolvedValue({
      data: { completedTaskIds: [] },
    });
    (ehrApi.getClinicalEscalationFeed as jest.Mock).mockResolvedValue({
      data: { items: [] },
    });
    (ehrApi.acknowledgeClinicalEscalation as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (ehrApi.completeClinicalEscalation as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (ehrApi.completeNurseTask as jest.Mock).mockResolvedValue({ data: { ok: true } });
  });

  it('emits task counts generated from appointment workflow state', async () => {
    const onTaskCountsChange = jest.fn();

    const appointments = [
      {
        id: 'apt-1',
        appointmentDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        status: 'confirmed',
        createdBy: 'nurse-1',
        patient: {
          id: 'p-1',
          firstName: 'Kaylee',
          lastName: 'Dube',
        },
      },
    ];

    await act(async () => {
      render(
        <TaskManagement
          currentUser={{ id: 'nurse-1' }}
          appointments={appointments as any}
          onTaskCountsChange={onTaskCountsChange}
        />,
      );
    });

    await waitFor(() => {
      expect(onTaskCountsChange).toHaveBeenCalled();
    });

    const lastCall = onTaskCountsChange.mock.calls[onTaskCountsChange.mock.calls.length - 1][0];
    expect(lastCall.pending).toBeGreaterThanOrEqual(2); // triage + vitals
    expect(lastCall.inProgress).toBe(0);
    expect(lastCall.overdue).toBe(0);
  });

  it('counts server escalation tasks even when there are no appointments', async () => {
    const onTaskCountsChange = jest.fn();
    (ehrApi.getClinicalEscalationFeed as jest.Mock).mockResolvedValue({
      data: {
        items: [
          {
            id: 'esc-1',
            patientId: 'p-1',
            patientName: 'Kaylee Dube',
            severity: 'high',
            status: 'open',
            title: 'Escalate high NEWS2',
            summary: 'Patient requires immediate reassessment.',
            dueAt: new Date().toISOString(),
          },
        ],
      },
    });

    await act(async () => {
      render(
        <TaskManagement
          currentUser={{ id: 'nurse-1' }}
          appointments={[] as any}
          onTaskCountsChange={onTaskCountsChange}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('CLINICAL ESCALATION')).not.toBeNull();
    });

    await waitFor(() => {
      const latest = onTaskCountsChange.mock.calls[onTaskCountsChange.mock.calls.length - 1]?.[0];
      expect(latest?.pending).toBeGreaterThanOrEqual(1);
    });
  });

  it('acknowledges and completes escalation tasks through the escalation endpoints', async () => {
    (ehrApi.getClinicalEscalationFeed as jest.Mock).mockResolvedValue({
      data: {
        items: [
          {
            id: 'esc-1',
            patientId: 'p-1',
            patientName: 'Kaylee Dube',
            severity: 'critical',
            status: 'open',
            title: 'Escalate low oxygen saturation',
            summary: 'Clinical escalation requires urgent follow-up.',
            dueAt: new Date().toISOString(),
            recommendedAction: 'Reassess saturation and notify doctor.',
            trustSummary: {
              sourceLabel: 'Remote monitoring escalation signal',
              backingType: 'Remote monitoring linked alert',
              reviewState: 'Pending nurse review',
              classifierStage: 'Deterioration Review',
              riskBand: 'Critical',
            },
          },
        ],
      },
    });

    await act(async () => {
      render(
        <TaskManagement
          currentUser={{ id: 'nurse-1' }}
          appointments={[] as any}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /toggle task details for escalate low oxygen saturation/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Remote monitoring linked alert/i)).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    });

    await waitFor(() => {
      expect(ehrApi.acknowledgeClinicalEscalation).toHaveBeenCalledWith('esc-1', 'token', 'kids-clinic');
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Complete/i })).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Complete/i }));
    });

    await waitFor(() => {
      expect(ehrApi.completeClinicalEscalation).toHaveBeenCalledWith(
        'esc-1',
        { note: 'Reassess saturation and notify doctor.' },
        'token',
        'kids-clinic',
      );
    });
    expect(ehrApi.completeNurseTask).not.toHaveBeenCalled();
  });
});
