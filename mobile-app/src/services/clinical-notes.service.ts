import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface ClinicalNote {
  id?: string;
  appointmentId?: string;
  patientId: string;
  providerId: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  physicalExamination?: string;
  assessment?: string;
  plan?: string;
  additionalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SOAPNote {
  subjective?: string; // Chief Complaint + HPI
  objective?: string; // Physical Examination + Vitals
  assessment?: string; // Assessment/Diagnosis
  plan?: string; // Treatment Plan
}

class ClinicalNotesService {
  /**
   * Get medical records for a patient
   */
  async getPatientMedicalRecords(patientId: string): Promise<any[]> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MEDICAL_RECORD.PATIENT(patientId));
      const records = Array.isArray(response) ? response : response.data || response.records || [];
      console.log(`📋 [ClinicalNotesService] Loaded ${records.length} medical records for patient ${patientId}`);
      return records;
    } catch (error: any) {
      console.error('❌ [ClinicalNotesService] Error fetching medical records:', error);
      console.error('❌ [ClinicalNotesService] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }
  }

  /**
   * Get a specific medical record by ID
   */
  async getMedicalRecordById(recordId: string): Promise<any> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MEDICAL_RECORD.BY_ID(recordId));
      return response.data || response;
    } catch (error) {
      console.error('Error fetching medical record:', error);
      throw error;
    }
  }

  /**
   * Create a new medical record
   */
  async createMedicalRecord(record: Partial<ClinicalNote>): Promise<any> {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.MEDICAL_RECORD.PATIENT(record.patientId || ''), record);
      return response.data || response;
    } catch (error) {
      console.error('Error creating medical record:', error);
      throw error;
    }
  }

  /**
   * Update appointment notes (clinical documentation)
   */
  async updateAppointmentNotes(appointmentId: string, notes: {
    clinicalDocumentation?: {
      chiefComplaint?: string;
      historyOfPresentIllness?: string;
      physicalExamination?: string;
      clinicalAssessment?: string;
      plan?: string;
      additionalNotes?: string;
    };
    notes?: string;
    problems?: any[];
    allergies?: any[];
    diagnosisCodes?: string[];
    primaryDiagnosisCode?: string;
    primaryDiagnosisDescription?: string;
    diagnosisSnomedCode?: string;
    diagnosisSnomedTerm?: string;
  }): Promise<any> {
    try {
      // Get existing appointment notes
      const appointment = await ehrApi.get(API_ENDPOINTS.APPOINTMENT.BY_ID(appointmentId));
      let existingNotes: any = {};
      
      if (appointment.notes) {
        try {
          existingNotes = typeof appointment.notes === 'string' 
            ? JSON.parse(appointment.notes) 
            : appointment.notes;
        } catch {
          existingNotes = { notes: appointment.notes };
        }
      }

      // Merge with new notes
      const updatedNotes = {
        ...existingNotes,
        ...notes,
        clinicalDocumentation: {
          ...(existingNotes.clinicalDocumentation || {}),
          ...(notes.clinicalDocumentation || {}),
        },
      };

      // Update appointment - backend uses PATCH, not PUT
      const endpoint = API_ENDPOINTS.APPOINTMENT.UPDATE(appointmentId);
      console.log('📝 [ClinicalNotesService] Updating appointment notes:', {
        appointmentId,
        endpoint,
        notesLength: JSON.stringify(updatedNotes).length
      });
      
      // Prepare update payload with both notes and diagnosis codes
      const updatePayload: any = {
        notes: JSON.stringify(updatedNotes)
      };

      // Add diagnosis codes if provided
      if (notes.diagnosisCodes) {
        updatePayload.diagnosisCodes = notes.diagnosisCodes;
      }
      if (notes.primaryDiagnosisCode) {
        updatePayload.primaryDiagnosisCode = notes.primaryDiagnosisCode;
      }
      if (notes.primaryDiagnosisDescription) {
        updatePayload.primaryDiagnosisDescription = notes.primaryDiagnosisDescription;
      }
      if (notes.diagnosisSnomedCode) {
        updatePayload.diagnosisSnomedCode = notes.diagnosisSnomedCode;
      }
      if (notes.diagnosisSnomedTerm) {
        updatePayload.diagnosisSnomedTerm = notes.diagnosisSnomedTerm;
      }
      
      const response = await ehrApi.patch(
        endpoint,
        updatePayload
      );
      
      console.log('📝 [ClinicalNotesService] Notes updated successfully');
      return response.data || response;
    } catch (error: any) {
      console.error('❌ [ClinicalNotesService] Error updating appointment notes:', error);
      console.error('❌ [ClinicalNotesService] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
      });
      throw error;
    }
  }

  /**
   * Parse SOAP note from clinical documentation
   */
  parseSOAPNote(clinicalDoc: any): SOAPNote {
    return {
      subjective: `${clinicalDoc.chiefComplaint || ''}\n\n${clinicalDoc.historyOfPresentIllness || ''}`.trim(),
      objective: clinicalDoc.physicalExamination || '',
      assessment: clinicalDoc.clinicalAssessment || '',
      plan: clinicalDoc.additionalNotes || '',
    };
  }
}

export default new ClinicalNotesService();

