import { api } from './api';

export interface ApiImagingOrder {
  id: string;
  studyType?: string;
  modality?: string;
  requestedAt?: string;
  status?: string;
  reportId?: string;
  aiReviewSummary?: string;
}

export interface ApiImagingReport {
  id: string;
  findings?: string;
  impression?: string;
  radiologistName?: string;
  reportedAt?: string;
  aiSummary?: string;
}

export const ImagingService = {
  /** Imaging orders for a patient — latest first */
  ordersForPatient: (patientId: string): Promise<ApiImagingOrder[]> =>
    api.get<ApiImagingOrder[]>(`/imaging/orders/patient/${patientId}`)
      .then(r => r.data)
      .catch(() => []),

  /** Final text report */
  getReport: (reportId: string): Promise<ApiImagingReport | null> =>
    api.get<ApiImagingReport>(`/imaging/reports/${reportId}`)
      .then(r => r.data)
      .catch(() => null),
};
