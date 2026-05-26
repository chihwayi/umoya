import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

const PHI_FIELDS_TO_REMOVE = [
  'national_id', 'passport_number', 'registration_number',
  'full_name', 'first_name', 'last_name',
  'email', 'phone_number', 'address',
  'date_of_birth', 'ip_address', 'device_id',
];

@Injectable()
export class DeidExportService {
  deidentifyRecord(record: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};

    for (const [key, value] of Object.entries(record)) {
      if (PHI_FIELDS_TO_REMOVE.includes(key)) continue;

      if (key === 'age' || key === 'age_years') {
        safe[key] = this.generaliseAge(value);
        continue;
      }

      if ((key.endsWith('_date') || key === 'dob') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        safe[key] = value.substring(0, 7);
        continue;
      }

      safe[key] = value;
    }

    return safe;
  }

  private generaliseAge(age: number): string {
    if (age >= 90) return '90+';
    const band = Math.floor(age / 5) * 5;
    return `${band}-${band + 4}`;
  }

  async exportCohortDeidentified(params: {
    cohortPatients: any[];
    fields: string[];
    exportedBy: string;
    cohortName: string;
    cohortCriteria: any;
    purpose: string;
    approvedBy?: string;
    db: any;
  }): Promise<{ downloadToken: string; rowCount: number; records: any[] }> {
    const deidentified = params.cohortPatients.map(p => {
      const subset: Record<string, any> = {};
      for (const f of params.fields) {
        if (f in p) subset[f] = p[f];
      }
      return this.deidentifyRecord(subset);
    });

    const downloadToken = randomBytes(32).toString('hex');

    await params.db.query(
      `INSERT INTO deid_export_log
         (exported_by, cohort_name, cohort_criteria, row_count, export_format,
          de_id_method, fields_exported, purpose, approved_by, download_token)
       VALUES ($1,$2,$3,$4,'csv','safe_harbor',$5,$6,$7,$8)`,
      [params.exportedBy, params.cohortName, JSON.stringify(params.cohortCriteria),
       deidentified.length, params.fields, params.purpose, params.approvedBy ?? null, downloadToken],
    );

    return { downloadToken, rowCount: deidentified.length, records: deidentified };
  }

  toCsv(records: any[]): string {
    if (!records.length) return '';
    const headers = Object.keys(records[0]);
    const rows = records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
