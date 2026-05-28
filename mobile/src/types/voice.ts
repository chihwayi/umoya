export interface ClinicalStructuredData {
  chiefComplaint?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
  };
  diagnoses?: string[];
  medications?: string[];
  plan?: string;
  followUp?: string;
}
