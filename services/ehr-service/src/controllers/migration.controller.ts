import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  MigrationDryRunResult,
  MigrationImportResult,
  MigrationIssue,
  MigrationJob,
  PatientMigrationRow,
} from '../dto/migration.dto';

const migrationJobs = new Map<string, MigrationJob>();

const HEADER_MAP: Record<string, keyof PatientMigrationRow> = {
  patientnumber: 'patientNumber',
  patient_number: 'patientNumber',
  mrn: 'patientNumber',
  firstname: 'firstName',
  first_name: 'firstName',
  lastname: 'lastName',
  last_name: 'lastName',
  dateofbirth: 'dateOfBirth',
  date_of_birth: 'dateOfBirth',
  dob: 'dateOfBirth',
  gender: 'gender',
  nationalid: 'nationalId',
  national_id: 'nationalId',
  idnumber: 'nationalId',
  id_number: 'nationalId',
  phone: 'phone',
  email: 'email',
  address: 'address',
  city: 'city',
  emergencycontactname: 'emergencyContactName',
  emergency_contact_name: 'emergencyContactName',
  emergencycontactphone: 'emergencyContactPhone',
  emergency_contact_phone: 'emergencyContactPhone',
  medicalaidprovider: 'medicalAidProvider',
  medical_aid_provider: 'medicalAidProvider',
  medicalaidname: 'medicalAidProvider',
  medical_aid_name: 'medicalAidProvider',
  medicalaidnumber: 'medicalAidNumber',
  medical_aid_number: 'medicalAidNumber',
  allergies: 'allergies',
  medicalhistory: 'medicalHistory',
  medical_history: 'medicalHistory',
  chronicconditions: 'medicalHistory',
  chronic_conditions: 'medicalHistory',
};

@ApiTags('Data Migration')
@ApiBearerAuth()
@Controller('migration')
@UseGuards(JwtAuthGuard)
export class MigrationController {
  @Post('patients/upload')
  @ApiOperation({ summary: 'Upload a patient CSV migration file for review' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPatients(@UploadedFile() file: Express.Multer.File): Promise<MigrationJob> {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    const content = this.readUploadedFile(file);
    const records = this.parsePatientCsv(content);
    const job: MigrationJob = {
      id: randomUUID(),
      fileName: file.originalname || 'patients.csv',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      totalRows: records.length,
      records,
    };

    migrationJobs.set(job.id, job);
    return job;
  }

  @Get('patients/jobs/:jobId')
  @ApiOperation({ summary: 'Get a patient migration job' })
  getJob(@Param('jobId') jobId: string): MigrationJob {
    return this.getMigrationJob(jobId);
  }

  @Post('patients/jobs/:jobId/dry-run')
  @ApiOperation({ summary: 'Validate a patient migration job without importing records' })
  async dryRun(@Param('jobId') jobId: string, @Req() req: RequestWithTenant): Promise<MigrationDryRunResult> {
    const job = this.getMigrationJob(jobId);
    const result = await this.evaluateRows(req.tenantDb!, job.records);
    job.dryRun = result;
    job.status = 'dry_run_complete';
    migrationJobs.set(job.id, job);
    return result;
  }

  @Post('patients/jobs/:jobId/import')
  @ApiOperation({ summary: 'Import valid non-duplicate patient rows from a migration job' })
  async importPatients(
    @Param('jobId') jobId: string,
    @Req() req: RequestWithTenant,
    @Body() body: { confirm?: boolean } = {},
  ): Promise<MigrationImportResult> {
    if (!body.confirm) {
      throw new BadRequestException('Import confirmation is required');
    }

    const job = this.getMigrationJob(jobId);
    const dryRun = await this.evaluateRows(req.tenantDb!, job.records);
    const blockingErrors = dryRun.issues.filter((issue) => issue.severity === 'error');
    if (blockingErrors.length > 0) {
      job.dryRun = dryRun;
      job.status = 'failed';
      migrationJobs.set(job.id, job);
      throw new BadRequestException({
        message: 'Fix migration errors before import',
        issues: blockingErrors,
      });
    }

    const importResult = await this.insertValidRows(req.tenantDb!, job.records);
    job.dryRun = dryRun;
    job.importResult = importResult;
    job.status = 'imported';
    job.importedAt = new Date().toISOString();
    migrationJobs.set(job.id, job);
    return importResult;
  }

  private getMigrationJob(jobId: string): MigrationJob {
    const job = migrationJobs.get(jobId);
    if (!job) {
      throw new BadRequestException('Migration job not found');
    }
    return job;
  }

  private readUploadedFile(file: Express.Multer.File): string {
    if (file.buffer) {
      return file.buffer.toString('utf8');
    }
    if (file.path) {
      return readFileSync(file.path, 'utf8');
    }
    throw new BadRequestException('Uploaded file could not be read');
  }

  private parsePatientCsv(content: string): PatientMigrationRow[] {
    const rows = this.parseCsv(content);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one patient row');
    }

    const headers = rows[0].map((header) => HEADER_MAP[this.normalizeHeader(header)]);
    if (!headers.some(Boolean)) {
      throw new BadRequestException('CSV headers do not match patient migration fields');
    }

    return rows.slice(1)
      .filter((row) => row.some((value) => value.trim().length > 0))
      .map((row, index) => {
        const record: PatientMigrationRow = { rowNumber: index + 2 };
        headers.forEach((field, columnIndex) => {
          if (!field || field === 'rowNumber') return;
          const value = (row[columnIndex] || '').trim();
          if (value) {
            record[field] = value as never;
          }
        });
        return record;
      });
  }

  private parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const next = content[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  }

  private normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private async evaluateRows(tenantDb: DataSource, records: PatientMigrationRow[]): Promise<MigrationDryRunResult> {
    const issues: MigrationIssue[] = [];
    const seenPatientNumbers = new Set<string>();
    const seenNationalIds = new Set<string>();
    let duplicateRows = 0;

    for (const record of records) {
      this.validateRequiredFields(record, issues);

      const patientNumber = this.clean(record.patientNumber);
      const nationalId = this.clean(record.nationalId);

      if (patientNumber) {
        if (seenPatientNumbers.has(patientNumber.toLowerCase())) {
          issues.push({
            rowNumber: record.rowNumber,
            severity: 'warning',
            field: 'patientNumber',
            message: 'Duplicate patient number inside this file; row will be skipped',
          });
          duplicateRows += 1;
        }
        seenPatientNumbers.add(patientNumber.toLowerCase());
      }

      if (nationalId) {
        if (seenNationalIds.has(nationalId.toLowerCase())) {
          issues.push({
            rowNumber: record.rowNumber,
            severity: 'warning',
            field: 'nationalId',
            message: 'Duplicate national ID inside this file; row will be skipped',
          });
          duplicateRows += 1;
        }
        seenNationalIds.add(nationalId.toLowerCase());
      }

      if (patientNumber || nationalId) {
        const existing = await tenantDb.query(
          `SELECT id FROM patients
           WHERE ($1::text IS NOT NULL AND patient_number = $1)
              OR ($2::text IS NOT NULL AND id_number = $2)
           LIMIT 1`,
          [patientNumber || null, nationalId || null],
        );

        if (Array.isArray(existing) && existing.length > 0) {
          issues.push({
            rowNumber: record.rowNumber,
            severity: 'warning',
            message: 'Matching patient already exists; row will be skipped',
          });
          duplicateRows += 1;
        }
      }
    }

    const errorRows = new Set(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.rowNumber)).size;
    const warningRows = new Set(issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.rowNumber)).size;

    return {
      totalRows: records.length,
      validRows: Math.max(0, records.length - errorRows - warningRows),
      duplicateRows: warningRows || duplicateRows,
      errorRows,
      issues,
    };
  }

  private validateRequiredFields(record: PatientMigrationRow, issues: MigrationIssue[]): void {
    const requiredFields: Array<keyof PatientMigrationRow> = ['firstName', 'lastName', 'dateOfBirth', 'gender'];
    requiredFields.forEach((field) => {
      if (!this.clean(record[field] as string | undefined)) {
        issues.push({
          rowNumber: record.rowNumber,
          severity: 'error',
          field,
          message: `${String(field)} is required`,
        });
      }
    });

    if (record.dateOfBirth && Number.isNaN(Date.parse(record.dateOfBirth))) {
      issues.push({
        rowNumber: record.rowNumber,
        severity: 'error',
        field: 'dateOfBirth',
        message: 'dateOfBirth must be a valid date',
      });
    }

    const gender = this.normalizeGender(record.gender);
    if (record.gender && !gender) {
      issues.push({
        rowNumber: record.rowNumber,
        severity: 'error',
        field: 'gender',
        message: 'gender must be male, female, or other',
      });
    }
  }

  private async insertValidRows(tenantDb: DataSource, records: PatientMigrationRow[]): Promise<MigrationImportResult> {
    const issues: MigrationIssue[] = [];
    let insertedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;

    for (const record of records) {
      const rowIssues: MigrationIssue[] = [];
      this.validateRequiredFields(record, rowIssues);
      if (rowIssues.some((issue) => issue.severity === 'error')) {
        failedRows += 1;
        issues.push(...rowIssues);
        continue;
      }

      const patientNumber = this.clean(record.patientNumber) || this.generatePatientNumber(record);
      const nationalId = this.clean(record.nationalId);
      const existing = await tenantDb.query(
        `SELECT id FROM patients
         WHERE patient_number = $1
            OR ($2::text IS NOT NULL AND id_number = $2)
         LIMIT 1`,
        [patientNumber, nationalId || null],
      );

      if (Array.isArray(existing) && existing.length > 0) {
        skippedRows += 1;
        issues.push({
          rowNumber: record.rowNumber,
          severity: 'warning',
          message: 'Matching patient already exists; row skipped',
        });
        continue;
      }

      await tenantDb.query(
        `INSERT INTO patients (
          patient_number, first_name, last_name, date_of_birth, gender, id_number,
          phone, email, address, city, emergency_contact_name, emergency_contact_phone,
          medical_aid_name, medical_aid_number, allergies, chronic_conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          patientNumber,
          this.clean(record.firstName),
          this.clean(record.lastName),
          this.toDateOnly(record.dateOfBirth),
          this.normalizeGender(record.gender),
          nationalId || null,
          this.clean(record.phone) || null,
          this.clean(record.email) || null,
          this.clean(record.address) || null,
          this.clean(record.city) || null,
          this.clean(record.emergencyContactName) || null,
          this.clean(record.emergencyContactPhone) || null,
          this.clean(record.medicalAidProvider) || null,
          this.clean(record.medicalAidNumber) || null,
          this.clean(record.allergies) || null,
          this.clean(record.medicalHistory) || null,
        ],
      );
      insertedRows += 1;
    }

    return {
      insertedRows,
      skippedRows,
      failedRows,
      issues,
    };
  }

  private clean(value?: string): string {
    return (value || '').trim();
  }

  private normalizeGender(value?: string): string | null {
    const normalized = this.clean(value).toLowerCase();
    if (['male', 'm'].includes(normalized)) return 'male';
    if (['female', 'f'].includes(normalized)) return 'female';
    if (['other', 'o'].includes(normalized)) return 'other';
    return null;
  }

  private toDateOnly(value?: string): string | null {
    if (!value) return null;
    return new Date(value).toISOString().slice(0, 10);
  }

  private generatePatientNumber(record: PatientMigrationRow): string {
    return `MIG${Date.now().toString().slice(-6)}${String(record.rowNumber).padStart(4, '0')}`;
  }
}
