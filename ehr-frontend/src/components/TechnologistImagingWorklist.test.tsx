import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TechnologistImagingWorklist from './TechnologistImagingWorklist';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getImagingOrders: jest.fn(),
    getImagingStudies: jest.fn(),
    prepareImagingOrderAiReview: jest.fn(),
    scheduleImagingOrder: jest.fn(),
    createImagingStudy: jest.fn(),
    completeImagingStudy: jest.fn(),
  },
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock('./GlobalNotification', () => ({
  useNotification: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

describe('TechnologistImagingWorklist', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    (ehrApi.getImagingOrders as jest.Mock).mockResolvedValue({
      data: {
        orders: [
          {
            id: 'order-1',
            patient_id: 'patient-1',
            patient_name: 'Kaylee Dube',
            patient_number: 'P001',
            study_name: 'Chest X-Ray',
            study_type_id: 'study-1',
            modality_name: 'Radiography',
            order_status: 'ordered',
            payment_status: 'payment_confirmed',
            ordered_at: '2026-03-26T10:00:00.000Z',
            priority: 'routine',
            clinical_indication: 'Persistent cough',
          },
        ],
      },
    });
    (ehrApi.getImagingStudies as jest.Mock).mockResolvedValue({
      data: { studies: [] },
    });
    (ehrApi.prepareImagingOrderAiReview as jest.Mock).mockResolvedValue({
      data: {
        id: 'review-1',
        appropriatenessStatus: 'acceptable_with_caution',
        rationale: 'Chest X-Ray can proceed with caution because protocol confirmation is still required.',
        protocolSummary: {
          preparationInstructions: 'Remove metallic objects before acquisition.',
          contrastRequired: false,
        },
        blockingIssues: [
          {
            code: 'recent_similar_imaging_order',
            message: 'Patient already has a similar imaging order in the last 30 days.',
          },
        ],
        supportingSignals: [
          {
            code: 'guideline_recommendation',
            message: 'Chest radiograph is appropriate first-line imaging for persistent cough.',
          },
        ],
      },
    });
  });

  it('prepares and renders the AI protocol review for a ready imaging order', async () => {
    render(
      <TechnologistImagingWorklist
        tenantSlug="kids-clinic"
        token="token"
        currentUser={{ id: 'tech-1' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Chest X-Ray/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /AI Protocol/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Protocol/i }));

    await waitFor(() => {
      expect(ehrApi.prepareImagingOrderAiReview).toHaveBeenCalledWith(
        'kids-clinic',
        'token',
        'order-1',
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/AI Protocol Review/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/Patient already has a similar imaging order in the last 30 days./i),
      ).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/Chest radiograph is appropriate first-line imaging for persistent cough./i),
      ).toBeTruthy();
    });
  });
});
