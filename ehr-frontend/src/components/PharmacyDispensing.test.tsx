import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PharmacyDispensing from './PharmacyDispensing';
import { pharmacyApi } from '../services/api';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ tenantSlug: 'kids-clinic' }),
}));

jest.mock('../services/api', () => ({
  pharmacyApi: {
    getPendingPrescriptions: jest.fn(),
    checkPrescriptionStock: jest.fn(),
    prepareDispensePlan: jest.fn(),
    dispensePrescription: jest.fn(),
  },
}));

jest.mock('./GlobalNotification', () => ({
  useNotification: () => ({
    showSuccess: jest.fn(),
  }),
}));

describe('PharmacyDispensing', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'token');
    (pharmacyApi.getPendingPrescriptions as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'rx-1',
          prescription_number: 'rx-1',
          patient_id: 'patient-1',
          patient_name: 'Kaylee Dube',
          patient_number: 'P001',
          prescriber_name: 'Doctor One',
          medication_name: 'Amoxicillin',
          generic_name: 'amoxicillin',
          form: 'capsules',
          quantity: 14,
          instructions: 'Take twice daily',
          stockAvailability: {
            available: true,
            quantityNeeded: 14,
            quantityAvailable: 14,
            matchingItems: [],
            message: 'Stock available: 14 units',
          },
        },
      ],
    });
    (pharmacyApi.checkPrescriptionStock as jest.Mock).mockResolvedValue({
      data: {
        available: true,
        quantityNeeded: 14,
        quantityAvailable: 14,
        message: 'Stock available: 14 units',
        matchingItems: [
          {
            id: 'inv-1',
            name: 'Amoxicillin 500mg',
            genericName: 'amoxicillin',
            quantityOnHand: 20,
            unitPrice: 2,
            expiryDate: '2026-12-31',
            batchNumber: 'B1',
            hasSufficientStock: true,
          },
        ],
      },
    });
    (pharmacyApi.prepareDispensePlan as jest.Mock).mockResolvedValue({
      data: {
        review: {
          id: 'review-1',
          recommendedActions: [
            { actionType: 'stewardship_review', message: 'Review antimicrobial duration before dispensing.' },
          ],
        },
        substitutionRecommendations: [
          {
            id: 'sub-1',
            sourceMedicationName: 'Amoxicillin',
            genericAlternative: 'amoxicillin generic',
            rationale: 'Equivalent generic available',
            costImpact: { savingAmount: 8 },
          },
        ],
        highRiskReview: {
          stewardshipReviews: [
            {
              id: 'stew-1',
              antibioticName: 'Amoxicillin',
              stewardshipRecommendation: 'Review duration and de-escalate if culture negative.',
              reviewRequired: true,
            },
          ],
        },
        reviewChecklist: {
          requiresAcknowledgement: true,
          summary: 'Pharmacist acknowledgment is required before dispensing because AI review signals were generated.',
        },
      },
    });
    (pharmacyApi.dispensePrescription as jest.Mock).mockResolvedValue({
      data: { id: 'disp-1' },
    });
  });

  it('requires pharmacist acknowledgment before dispensing a plan with AI review signals', async () => {
    render(<PharmacyDispensing />);

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Amoxicillin'));

    await waitFor(() => {
      expect(pharmacyApi.prepareDispensePlan).toHaveBeenCalledWith({ prescriptionId: 'rx-1' }, 'token', 'kids-clinic');
    });
    await waitFor(() => {
      expect(screen.getByText(/AI Dispense Review/i)).toBeTruthy();
    });

    const dispenseButton = screen.getByRole('button', { name: /Dispense Prescription/i });
    expect((dispenseButton as HTMLButtonElement).disabled).toBe(true);

    const acknowledgementCheckbox = screen.getByRole('checkbox', {
      name: /I reviewed the reconciliation, substitution, and stewardship guidance/i,
    }) as HTMLInputElement;

    fireEvent.click(acknowledgementCheckbox);

    expect((dispenseButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(dispenseButton);

    await waitFor(() => {
      expect(pharmacyApi.dispensePrescription).toHaveBeenCalledWith(
        'rx-1',
        expect.objectContaining({
          medicationReviewId: 'review-1',
          selectedSubstitutionRecommendationIds: ['sub-1'],
          stewardshipReviewIds: ['stew-1'],
          aiReviewAcknowledged: true,
        }),
        'token',
        'kids-clinic',
      );
    });
  });
});
