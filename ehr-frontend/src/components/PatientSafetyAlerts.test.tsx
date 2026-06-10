import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PatientSafetyAlerts from './PatientSafetyAlerts';
import { SafetyAlert, SafetyAlertCounts } from '../hooks/useSafetyAlerts';

// PatientSafetyAlerts is a presentational component: the alert-generation,
// escalation-feed and acknowledgement behaviour now live in the useSafetyAlerts
// hook (covered in useSafetyAlerts.test.tsx). These tests assert that the
// component renders the alerts it is given and wires its action callbacks.

const escalationAlert: SafetyAlert = {
  id: 'esc-1',
  patientId: 'p-1',
  patientName: 'Kaylee Dube',
  alertType: 'escalation',
  severity: 'critical',
  title: 'Escalate NEWS2 deterioration',
  description: 'Clinical escalation requires nurse action.',
  details: 'Review patient now.',
  createdAt: new Date().toISOString(),
  isActive: true,
  requiresAction: true,
  actionRequired: 'Review patient now.',
  trustSummary: {
    sourceLabel: 'Early warning deterioration signal',
    backingType: 'Rule-backed safety escalation',
    reviewState: 'Pending nurse review',
    classifierStage: 'Deterioration Review',
    riskBand: 'High',
    evidenceCount: 1,
  },
};

const counts: SafetyAlertCounts = {
  total: 1,
  active: 1,
  critical: 1,
  high: 0,
  acknowledged: 0,
};

describe('PatientSafetyAlerts', () => {
  it('renders the alerts it is handed, including server escalations', () => {
    render(
      <PatientSafetyAlerts
        alerts={[escalationAlert]}
        counts={counts}
        onAcknowledge={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByText('Escalate NEWS2 deterioration')).not.toBeNull();
    // Counts surface in the header stats.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);

    // Trust-summary detail reveals on expansion.
    fireEvent.click(screen.getByText('Escalate NEWS2 deterioration'));
    expect(screen.queryByText(/Rule-backed safety escalation/i)).not.toBeNull();
  });

  it('invokes onAcknowledge with the alert id when Acknowledge is clicked', () => {
    const onAcknowledge = jest.fn();
    render(
      <PatientSafetyAlerts
        alerts={[escalationAlert]}
        counts={counts}
        onAcknowledge={onAcknowledge}
        onDismiss={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Acknowledge/i }));
    expect(onAcknowledge).toHaveBeenCalledWith('esc-1');
  });

  it('hides acknowledged alerts (and their Acknowledge button) by default', () => {
    render(
      <PatientSafetyAlerts
        alerts={[{ ...escalationAlert, acknowledgedAt: new Date().toISOString(), isActive: false }]}
        counts={{ ...counts, active: 0, critical: 0, acknowledged: 1 }}
        onAcknowledge={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    // showAcknowledged is off by default, so an acknowledged alert is filtered out entirely.
    expect(screen.queryByText('Escalate NEWS2 deterioration')).toBeNull();
    expect(screen.queryByRole('button', { name: /Acknowledge/i })).toBeNull();
  });
});
