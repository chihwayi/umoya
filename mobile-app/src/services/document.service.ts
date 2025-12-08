import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Document {
  id: string;
  patientId?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
  tags?: string[];
  description?: string;
}

class DocumentService {
  /**
   * Get documents for a patient
   */
  async getPatientDocuments(patientId: string): Promise<Document[]> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.DOCUMENTS.PATIENT(patientId));
      return Array.isArray(response) ? response : response.data || response.documents || [];
    } catch (error) {
      console.error('Error fetching patient documents:', error);
      return [];
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<Document> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.DOCUMENTS.BY_ID(documentId));
      return response.data || response;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error;
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(
    patientId: string,
    file: { uri: string; type: string; name: string },
    description?: string,
    tags?: string[]
  ): Promise<Document> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as any);
      formData.append('patientId', patientId);
      if (description) formData.append('description', description);
      if (tags) formData.append('tags', JSON.stringify(tags));

      const response = await ehrApi.post(API_ENDPOINTS.DOCUMENTS.UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data || response;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await ehrApi.delete(API_ENDPOINTS.DOCUMENTS.BY_ID(documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

export default new DocumentService();
