import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HIVClinicalVisitModal from './HIVClinicalVisitModal';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getMonitoringSchedules: jest.fn(),
    getHivClinicalVisits: jest.fn(),
    getAdherenceTracking: jest.fn(),
    checkTptEligibility: jest.fn(),
    getTptCompletionStatus: jest.fn(),
    getVlPathway: jest.fn(),
    getDsdStatus: jest.fn(),
    checkEacEligibility: jest.fn(),
    getHivVisitCount: jest.fn(),
    getApprovedArvChange: jest.fn(),
    getHivLookupData: jest.fn(),
    getVitals: jest.fn(),
    getPatientContext: jest.fn(),
    getMatchingLabResults: jest.fn(),
    createHivClinicalVisit: jest.fn(),
  },
}));

jest.mock('./GlobalNotification', () => ({
  useNotification: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock('./SnomedConceptPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="snomed-picker" />,
}));

describe('HIVClinicalVisitModal guideline blocking panel', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token-1');
    localStorage.setItem(
      'ehr_user',
      JSON.stringify({
        id: 'user-1',
        role: 'nurse',
        first_name: 'Nurse',
        last_name: 'One',
      }),
    );

    (ehrApi.getMonitoringSchedules as jest.Mock).mockResolvedValue({ data: { schedules: [] } });
    (ehrApi.getHivClinicalVisits as jest.Mock).mockResolvedValue({ data: { visits: [] } });
    (ehrApi.getAdherenceTracking as jest.Mock).mockResolvedValue({ data: { tracking: [] } });
    (ehrApi.checkTptEligibility as jest.Mock).mockResolvedValue({ data: { isEligible: true } });
    (ehrApi.getTptCompletionStatus as jest.Mock).mockResolvedValue({ data: {} });
    (ehrApi.getVlPathway as jest.Mock).mockResolvedValue({ data: { status: 'no_vl', overdue: false } });
    (ehrApi.getDsdStatus as jest.Mock).mockResolvedValue({
      data: { eligibleForDsd: false, currentModel: 'conventional' },
    });
    (ehrApi.checkEacEligibility as jest.Mock).mockResolvedValue({ data: { needsEac: false, activeEac: false } });
    (ehrApi.getHivVisitCount as jest.Mock).mockResolvedValue({
      data: {
        nextVisitNumber: 1,
        hasStartedArv: false,
      },
    });
    (ehrApi.getApprovedArvChange as jest.Mock).mockResolvedValue({ data: null });
    (ehrApi.getVitals as jest.Mock).mockResolvedValue({ data: { vitals: [] } });
    (ehrApi.getPatientContext as jest.Mock).mockResolvedValue({ data: null });
    (ehrApi.getMatchingLabResults as jest.Mock).mockResolvedValue({ data: { matched: false, viralLoad: null } });
    (ehrApi.createHivClinicalVisit as jest.Mock).mockResolvedValue({ data: { id: 'visit-1' } });

    (ehrApi.getHivLookupData as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'visit_types') {
        return Promise.resolve({
          data: {
            data: [
              { code: 'A', name: 'Present Self' },
              { code: 'B', name: 'Care Giver Pick-up' },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows blocking issues panel and disables save when guideline blockers exist', async () => {
    render(
      <HIVClinicalVisitModal
        enrollment={{
          id: 'enroll-1',
          patient_id: 'patient-1',
          first_name: 'Tariro',
          last_name: 'Dube',
          enrollment_number: 'ENR-001',
          gender: 'female',
          date_of_birth: '1992-03-02',
        }}
        tenantSlug="demo-clinic"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Record Clinical Visit/i)).toBeTruthy();
    });

    // Move to final step where Save is shown.
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save visit/i })).toBeTruthy();
    });

    expect(screen.getByText(/Guideline validation flags/i)).toBeTruthy();
    expect(screen.getAllByText(/Blocking issues/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ARV status is required before saving this visit/i)).toBeTruthy();

    const saveButton = screen.getByRole('button', { name: /save visit/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('auto-populates visit vitals from same-day nurse vitals and allows manual override', async () => {
    const visitDate = new Date().toISOString().split('T')[0];
    (ehrApi.getVitals as jest.Mock).mockResolvedValue({
      data: {
        vitals: [
          {
            recordedAt: `${visitDate}T07:45:00.000Z`,
            weight: 72.5,
            height: 168,
            bloodPressure: '118/76',
          },
        ],
      },
    });

    render(
      <HIVClinicalVisitModal
        enrollment={{
          id: 'enroll-1',
          patient_id: 'patient-1',
          first_name: 'Tariro',
          last_name: 'Dube',
          enrollment_number: 'ENR-001',
          gender: 'female',
          date_of_birth: '1992-03-02',
        }}
        tenantSlug="demo-clinic"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(ehrApi.getVitals).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Record Clinical Visit/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByTestId('same-day-vitals-autofill-note')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('72.5')).toBeTruthy();
    expect(screen.getByDisplayValue('168')).toBeTruthy();
    expect(screen.getByDisplayValue('118/76')).toBeTruthy();

    const weightInput = screen.getByDisplayValue('72.5') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '73.1' } });

    await waitFor(() => {
      expect(weightInput.value).toBe('73.1');
    });
    expect(screen.queryByTestId('same-day-vitals-autofill-note')).toBeNull();
  });

  it('auto-fills nurse name from logged-in user in clinician field', async () => {
    render(
      <HIVClinicalVisitModal
        enrollment={{
          id: 'enroll-1',
          patient_id: 'patient-1',
          first_name: 'Tariro',
          last_name: 'Dube',
          enrollment_number: 'ENR-001',
          gender: 'female',
          date_of_birth: '1992-03-02',
        }}
        tenantSlug="demo-clinic"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Record Clinical Visit/i)).toBeTruthy();
    });

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nurse One')).toBeTruthy();
    });
  });

  it('refreshes same-day nurse vitals on demand from step 2', async () => {
    const visitDate = new Date().toISOString().split('T')[0];
    (ehrApi.getVitals as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          vitals: [
            {
              recordedAt: `${visitDate}T07:45:00.000Z`,
              weight: 70.0,
              height: 168,
              bloodPressure: '118/76',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          vitals: [
            {
              recordedAt: `${visitDate}T08:30:00.000Z`,
              weight: 71.2,
              height: 168,
              bloodPressure: '120/78',
            },
          ],
        },
      });

    render(
      <HIVClinicalVisitModal
        enrollment={{
          id: 'enroll-1',
          patient_id: 'patient-1',
          first_name: 'Tariro',
          last_name: 'Dube',
          enrollment_number: 'ENR-001',
          gender: 'female',
          date_of_birth: '1992-03-02',
        }}
        tenantSlug="demo-clinic"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Record Clinical Visit/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('70')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /refresh nurse vitals/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /refresh nurse vitals/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('71.2')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('120/78')).toBeTruthy();
  });
});
