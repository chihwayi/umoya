import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImagingReportComposer from './ImagingReportComposer';
import { ehrApi } from '../services/api';

jest.mock('../services/api', () => ({
  ehrApi: {
    getImagingReportTemplates: jest.fn(),
    generateImagingReportDraft: jest.fn(),
    resolveImagingDiscrepancyReview: jest.fn(),
    acknowledgeImagingIncidentalFollowup: jest.fn(),
    completeImagingIncidentalFollowup: jest.fn(),
    getImagingReportIncidentalFollowups: jest.fn(),
    createImagingReport: jest.fn(),
    updateImagingReport: jest.fn(),
    signImagingReport: jest.fn(),
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

jest.mock('./SnomedConceptPicker', () => () => null);

describe('ImagingReportComposer', () => {
  beforeEach(() => {
    (ehrApi.getImagingReportTemplates as jest.Mock).mockResolvedValue({
      data: { templates: [] },
    });
    (ehrApi.generateImagingReportDraft as jest.Mock).mockResolvedValue({
      data: {
        id: 'draft-1',
        draftFindings: 'Right lower lobe consolidation with high AI confidence.',
        draftImpression: 'Findings are concerning for focal pneumonia.',
        draftRecommendations: 'Correlate clinically and consider short-interval follow-up chest imaging.',
        structuredDraft: {
          structured_findings: [
            {
              id: 'sf-1',
              region: 'Right lower lobe',
              finding: 'Consolidation',
              significance: 'significant',
              recommendation: 'Repeat chest imaging',
            },
          ],
        },
      },
    });
    (ehrApi.resolveImagingDiscrepancyReview as jest.Mock).mockResolvedValue({
      data: {
        id: 'disc-1',
        discrepancyStatus: 'needs_review',
        reviewStatus: 'resolved',
        rationale: 'Resolved by radiologist.',
      },
    });
    (ehrApi.acknowledgeImagingIncidentalFollowup as jest.Mock).mockResolvedValue({
      data: {
        id: 'follow-1',
        status: 'acknowledged',
      },
    });
    (ehrApi.completeImagingIncidentalFollowup as jest.Mock).mockResolvedValue({
      data: {
        id: 'follow-1',
        status: 'completed',
      },
    });
    (ehrApi.getImagingReportIncidentalFollowups as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('generates and applies a governed AI draft into report fields', async () => {
    render(
      <ImagingReportComposer
        tenantSlug="kids-clinic"
        token="token"
        currentUser={{ id: 'rad-1', role: 'radiologist' }}
        study={{
          id: 'study-1',
          imaging_order_id: 'order-1',
          patient_id: 'patient-1',
          study_name: 'Chest X-Ray',
          modality_code: 'XR',
          accession_number: 'ACC-1',
          clinical_history: 'Persistent cough',
          radiologist_assigned: 'rad-1',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Generate AI Draft/i })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate AI Draft/i }));

    await waitFor(() => {
      expect(ehrApi.generateImagingReportDraft).toHaveBeenCalledWith('kids-clinic', 'token', 'study-1');
      expect(screen.queryByText(/Governed AI Report Draft/i)).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply AI Draft/i }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue(/Right lower lobe consolidation with high AI confidence./i)).not.toBeNull();
      expect(screen.queryByDisplayValue(/Findings are concerning for focal pneumonia./i)).not.toBeNull();
      expect(screen.queryByDisplayValue(/Correlate clinically and consider short-interval follow-up chest imaging./i)).not.toBeNull();
    });
  });

  it('resolves discrepancy review and completes incidental follow-up from the report workflow panel', async () => {
    render(
      <ImagingReportComposer
        tenantSlug="kids-clinic"
        token="token"
        currentUser={{ id: 'rad-1', role: 'radiologist' }}
        study={{
          id: 'study-1',
          imaging_order_id: 'order-1',
          patient_id: 'patient-1',
          study_name: 'Chest X-Ray',
          modality_code: 'XR',
          accession_number: 'ACC-1',
          clinical_history: 'Persistent cough',
          radiologist_assigned: 'rad-1',
          report: {
            id: 'report-1',
            report_status: 'draft',
          },
          discrepancyReviews: [
            {
              id: 'disc-1',
              discrepancyStatus: 'needs_review',
              reviewStatus: 'generated',
              rationale: 'AI and report do not yet align.',
              discrepancySummary: {
                unmatchedAiLabels: ['Right lower lobe consolidation'],
              },
            },
          ],
          incidentalFollowups: [
            {
              id: 'follow-1',
              status: 'open',
              severity: 'critical',
              title: 'Radiology follow-up',
              summary: 'Critical incidental follow-up needed.',
              recommendedAction: 'Notify clinician and patient.',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Resolve/i }));

    await waitFor(() => {
      expect(ehrApi.resolveImagingDiscrepancyReview).toHaveBeenCalledWith(
        'kids-clinic',
        'token',
        'disc-1',
        { review_status: 'resolved' },
      );
      expect(screen.queryByText(/Workflow: resolved/i)).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => {
      expect(ehrApi.completeImagingIncidentalFollowup).toHaveBeenCalledWith(
        'kids-clinic',
        'token',
        'follow-1',
      );
      expect(screen.queryByText(/Status: completed/i)).not.toBeNull();
    });
  });
});
