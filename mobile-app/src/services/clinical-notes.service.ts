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
      return Array.isArray(response) ? response : response.data || response.records || [];
    } catch (error) {
      console.error('Error fetching medical records:', error);
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
      additionalNotes?: string;
    };
    notes?: string;
    problems?: any[];
    allergies?: any[];
  }): Promise<any> {
    try {
      // Get existing appointment notes
      const appointment = await ehrApi.get(API_ENDPOINTS.APPOINTMENT.BY_ID(appointmentId));
      let existingNotes = {};
      
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
          ...existingNotes.clinicalDocumentation,
          ...notes.clinicalDocumentation,
        },
      };

      // Update appointment
      const response = await ehrApi.put(
        API_ENDPOINTS.APPOINTMENT.UPDATE(appointmentId),
        { notes: JSON.stringify(updatedNotes) }
      );
      return response.data || response;
    } catch (error) {
      console.error('Error updating appointment notes:', error);
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

