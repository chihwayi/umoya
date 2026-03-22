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
  forPatient: (patientId: string) =>
    api.get<ApiDocument[]>(`/documents/patient/${patientId}`).then(r => r.data),
};
