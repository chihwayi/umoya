import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TriageQueue from './TriageQueue';

jest.mock('./GlobalNotification', () => ({
  useNotification: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
  }),
}));

describe('TriageQueue', () => {
  it('invokes AI triage callback when AI Suggest button is clicked', async () => {
    const onRecordVitals = jest.fn();
    const onTriageAssessment = jest.fn();
    const onTriageCopilotAnalyze = jest.fn().mockResolvedValue(undefined);

    const appointment = {
      id: 'apt-1',
      appointmentDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      appointmentType: 'Consultation',
      status: 'confirmed',
      reason: 'Fever',
      notes: '',
      priorityLevel: 'high',
      paymentStatus: 'paid',
      patient: {
        id: 'p-1',
        patientNumber: 'P001',
        firstName: 'Kaylee',
        lastName: 'Dube',
        dateOfBirth: '1995-01-01',
        gender: 'female',
        phone: '',
        email: '',
        bloodType: 'O+',
        allergies: '',
        chronicConditions: '',
      },
      doctor: {
        id: 'd-1',
        firstName: 'Doc',
        lastName: 'One',
      },
    };

    render(
      <TriageQueue
        appointments={[appointment as any]}
        onRecordVitals={onRecordVitals}
        onTriageAssessment={onTriageAssessment}
        onTriageCopilotAnalyze={onTriageCopilotAnalyze}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai suggest \+ open/i }));

    await waitFor(() => {
      expect(onTriageCopilotAnalyze).toHaveBeenCalledTimes(1);
    });
    expect(onTriageCopilotAnalyze).toHaveBeenCalledWith(expect.objectContaining({ id: 'apt-1' }));
    expect(onTriageAssessment).not.toHaveBeenCalled();
  });
});
