import { api } from './api';

// ─── Types mirroring backend Patient entity ───────────────────────────────────

export interface ApiPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  mrn?: string;
  bedNumber?: string;
  ward?: string;
  primaryDiagnosis?: string;
  admissionDate?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
}

export interface PatientListResponse {
  patients: ApiPatient[];
  total: number;
  page: number;
}

export const PatientsService = {
  list: (page = 1, limit = 50) =>
    api.get<PatientListResponse>(`/patients?page=${page}&limit=${limit}`)
      .then(r => r.data),

  get: (id: string) =>
    api.get<ApiPatient>(`/patients/${id}`).then(r => r.data),

  search: (q: string) =>
    api.get<ApiPatient[]>(`/patients/search?q=${encodeURIComponent(q)}`).then(r => r.data),

  /** History / conditions / allergies */
  history: (patientId: string) =>
    api.get<any>(`/patients/${patientId}/history/medical`).then(r => r.data),
};

// ─── Helper: full display name ────────────────────────────────────────────────
export function patientName(p: ApiPatient) {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Approximate age from ISO date string */
export function patientAge(dob?: string): number {
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
