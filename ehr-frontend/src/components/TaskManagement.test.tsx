import React from 'react';
import { render, waitFor } from '@testing-library/react';
import TaskManagement from './TaskManagement';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getNurseWorklistState: jest.fn(),
  },
}));

describe('TaskManagement', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token');
    localStorage.setItem('ehr_tenant_slug', 'kids-clinic');
    (ehrApi.getNurseWorklistState as jest.Mock).mockResolvedValue({
      data: { completedTaskIds: [] },
    });
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

    render(
      <TaskManagement
        currentUser={{ id: 'nurse-1' }}
        appointments={appointments as any}
        onTaskCountsChange={onTaskCountsChange}
      />,
    );

    await waitFor(() => {
      expect(onTaskCountsChange).toHaveBeenCalled();
    });

    const lastCall = onTaskCountsChange.mock.calls[onTaskCountsChange.mock.calls.length - 1][0];
    expect(lastCall.pending).toBeGreaterThanOrEqual(2); // triage + vitals
    expect(lastCall.inProgress).toBe(0);
    expect(lastCall.overdue).toBe(0);
  });
});

