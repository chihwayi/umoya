import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DemoAccessRequestsPanel } from './DemoAccessRequestsPanel';
import { demoAccessRequestAPI } from '../services/api';
import { NotificationProvider } from '../contexts/NotificationContext';

jest.mock('../services/api', () => ({
  demoAccessRequestAPI: {
    list: jest.fn(),
    updateStatus: jest.fn(),
    provisionTenant: jest.fn(),
  },
}));

const mockedDemoAccessRequestAPI = demoAccessRequestAPI as jest.Mocked<typeof demoAccessRequestAPI>;

const sampleRequest = {
  id: 'req-1',
  fullName: 'Dr Tariro Moyo',
  clinicName: 'Borrowdale Specialist Centre',
  workEmail: 'doctor@clinic.co.zw',
  phone: '+263771234567',
  roleTitle: 'Consultant physician',
  specialization: 'HIV Medicine',
  currentSystem: 'Legacy paper workflow',
  interestSummary: 'We want to test HIV workflows and DHIS2 reporting.',
  interestAreas: ['HIV program workflows', 'DHIS2 reporting'],
  preferredContactMethod: 'email' as const,
  status: 'new' as const,
  adminNotes: '',
  assignedTenantId: null,
  assignedSubdomain: null,
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
};

describe('DemoAccessRequestsPanel', () => {
  beforeEach(() => {
    mockedDemoAccessRequestAPI.list.mockResolvedValue([sampleRequest]);
    mockedDemoAccessRequestAPI.updateStatus.mockResolvedValue({
      ...sampleRequest,
      status: 'approved',
      assignedSubdomain: 'borrowdale-trial',
      adminNotes: 'Provision trial next.',
    });
    mockedDemoAccessRequestAPI.provisionTenant.mockResolvedValue({
      request: {
        ...sampleRequest,
        status: 'provisioned',
        assignedTenantId: 'tenant-1',
        assignedSubdomain: 'borrowdale-trial',
        adminNotes: 'Testing tenant provisioned: borrowdale-trial',
      },
      tenant: {
        id: 'tenant-1',
        subdomain: 'borrowdale-trial',
      } as any,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads and renders incoming requests', async () => {
    render(
      <NotificationProvider>
        <DemoAccessRequestsPanel />
      </NotificationProvider>,
    );

    expect(await screen.findByText('Dr Tariro Moyo')).toBeInTheDocument();
    expect(screen.getByText(/Borrowdale Specialist Centre/i)).toBeInTheDocument();
    expect(screen.getByText(/DHIS2 reporting/i)).toBeInTheDocument();
  });

  it('updates request review status', async () => {
    render(
      <NotificationProvider>
        <DemoAccessRequestsPanel />
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByText('Dr Tariro Moyo'));
    fireEvent.change(screen.getByDisplayValue('new'), { target: { value: 'approved' } });
    fireEvent.change(screen.getByPlaceholderText('testing-tenant-subdomain'), { target: { value: 'borrowdale-trial' } });
    fireEvent.change(
      screen.getByPlaceholderText(/Capture decision notes/i),
      { target: { value: 'Provision trial next.' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Save review/i }));

    await waitFor(() => {
      expect(mockedDemoAccessRequestAPI.updateStatus).toHaveBeenCalledWith('req-1', expect.objectContaining({
        status: 'approved',
        assignedSubdomain: 'borrowdale-trial',
      }));
    });
  });

  it('provisions a testing tenant in one click', async () => {
    render(
      <NotificationProvider>
        <DemoAccessRequestsPanel />
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByText('Dr Tariro Moyo'));
    fireEvent.click(screen.getByRole('button', { name: /Provision testing tenant/i }));

    await waitFor(() => {
      expect(mockedDemoAccessRequestAPI.provisionTenant).toHaveBeenCalledWith('req-1');
    });
  });
});
