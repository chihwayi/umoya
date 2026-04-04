import { api } from './api';

export interface ApiDocument {
  id: string;
  patientId: string;
  documentType: string;
  documentName: string;
  description?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  url?: string;
  tags?: string[];
}

export const DocumentsService = {
  forCurrentPatient: () =>
    api.get<ApiDocument[]>('/patient-portal/documents').then(r => r.data),
};
