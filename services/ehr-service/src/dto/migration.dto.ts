export type MigrationJobStatus = 'uploaded' | 'dry_run_complete' | 'imported' | 'failed';

export type MigrationSeverity = 'error' | 'warning';

export interface PatientMigrationRow {
  rowNumber: number;
  patientNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  allergies?: string;
  medicalHistory?: string;
}

export interface MigrationIssue {
  rowNumber: number;
  severity: MigrationSeverity;
  field?: string;
  message: string;
}

export interface MigrationDryRunResult {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  issues: MigrationIssue[];
}

export interface MigrationImportResult {
  insertedRows: number;
  skippedRows: number;
  failedRows: number;
  issues: MigrationIssue[];
}

export interface MigrationJob {
  id: string;
  fileName: string;
  status: MigrationJobStatus;
  uploadedAt: string;
  importedAt?: string;
  totalRows: number;
  records: PatientMigrationRow[];
  dryRun?: MigrationDryRunResult;
  importResult?: MigrationImportResult;
}
