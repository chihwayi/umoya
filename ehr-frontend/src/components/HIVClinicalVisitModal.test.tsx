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
        tenantSlug="bulawayo-general"
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
});
