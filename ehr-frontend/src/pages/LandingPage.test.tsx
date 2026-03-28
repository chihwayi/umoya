import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { tenantApi } from '../services/api';

jest.mock('../services/api', () => ({
  tenantApi: {
    submitDemoAccessRequest: jest.fn(),
  },
}));

const mockedTenantApi = tenantApi as jest.Mocked<typeof tenantApi>;

describe('LandingPage', () => {
  beforeEach(() => {
    mockedTenantApi.submitDemoAccessRequest.mockResolvedValue({ data: { message: 'ok' } as any });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders key platform differentiators including DHIS2', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Next-generation clinical AI platform/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('DHIS2').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FHIR R4/i).length).toBeGreaterThan(0);
  });

  it('submits a guided test access request', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Dr. Tariro Moyo'), { target: { value: 'Dr Tariro Moyo' } });
    fireEvent.change(screen.getByPlaceholderText('Borrowdale Specialist Centre'), { target: { value: 'Borrowdale Specialist Centre' } });
    fireEvent.change(screen.getByPlaceholderText('doctor@clinic.co.zw'), { target: { value: 'doctor@clinic.co.zw' } });
    fireEvent.change(screen.getByPlaceholderText('+263 77 123 4567'), { target: { value: '+263771234567' } });
    fireEvent.change(screen.getByPlaceholderText('Consultant physician'), { target: { value: 'Consultant physician' } });
    fireEvent.change(screen.getByPlaceholderText('Internal medicine, maternity, radiology'), { target: { value: 'HIV Medicine' } });
    fireEvent.change(screen.getByPlaceholderText('Current EHR or clinical workflow pain point'), { target: { value: 'Legacy paper workflow' } });
    fireEvent.change(
      screen.getByPlaceholderText(/Tell us what you want to test/i),
      { target: { value: 'We want to test HIV workflows, DHIS2 reporting, and PostVisit AI for follow-up.' } },
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Request test access/i })[0]);

    await waitFor(() => {
      expect(mockedTenantApi.submitDemoAccessRequest).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Request received/i)).toBeInTheDocument();
  });
});
