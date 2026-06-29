import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

const HIPAA_18_IDENTIFIERS = [
  'name', 'first_name', 'last_name', 'middle_name',
  'date_of_birth', 'dob',
  'phone', 'phone_number', 'mobile',
  'address', 'street_address', 'city', 'ward',
  'national_id', 'passport_number', 'medical_record_number', 'patient_id',
  'email', 'email_address',
  'ip_address', 'device_id',
  'photo', 'biometric',
  'account_number', 'certificate_number',
  'vehicle_id', 'url', 'license_number',
];

const AGE_BANDS = [
  { max: 5,  label: '<5' },
  { max: 15, label: '5-14' },
  { max: 25, label: '15-24' },
  { max: 35, label: '25-34' },
  { max: 50, label: '35-49' },
  { max: 65, label: '50-64' },
  { max: Infinity, label: '65+' },
];

@Injectable()
export class ResearchDeidentificationService {
  private readonly pseudoIdSalt: string;
  private readonly dateShiftSalt: string;

  constructor() {
    this.pseudoIdSalt = process.env.RESEARCH_PSEUDO_ID_SALT ?? 'default-pseudo-salt-change-in-prod';
    this.dateShiftSalt = process.env.RESEARCH_DATE_SHIFT_SALT ?? 'default-date-shift-salt-change-in-prod';
  }

  deidentifyRecord(record: Record<string, any>): Record<string, any> {
    const patientId: string | undefined = record.patient_id;
    const pseudoId = patientId ? this.computePseudoId(patientId) : undefined;
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(record)) {
      if (HIPAA_18_IDENTIFIERS.includes(key)) continue;

      if ((key === 'date_of_birth' || key === 'dob') && typeof value === 'string') {
        result['age_band'] = this.computeAgeBand(value);
        continue;
      }

      if ((key.endsWith('_date') || key.endsWith('_at')) && typeof value === 'string' && patientId) {
        const shifted = this.shiftDate(value, patientId);
        if (shifted !== null) { result[key] = shifted; }
        continue;
      }

      if (key === 'facility_id' || key === 'facility_name' || key === 'clinic_name') {
        continue;
      }

      result[key] = value;
    }

    if (pseudoId) result['pseudo_id'] = pseudoId;
    return result;
  }

  deidentifyBatch(records: Record<string, any>[]): Record<string, any>[] {
    return records.map(r => this.deidentifyRecord(r));
  }

  computePseudoId(patientId: string): string {
    return createHash('sha256')
      .update(patientId + this.pseudoIdSalt)
      .digest('hex')
      .substring(0, 16);
  }

  computeAgeBand(dob: string): string {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return 'unknown';
    const ageMs = Date.now() - birth.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
    if (age >= 89) return '65+';
    const band = AGE_BANDS.find(b => age < b.max);
    return band ? band.label : '65+';
  }

  shiftDate(date: string, patientId: string): string | null {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const shiftDays = this.computeShift(patientId);
    d.setDate(d.getDate() + shiftDays);
    return d.toISOString().substring(0, 10);
  }

  private computeShift(patientId: string): number {
    const hex = createHash('sha256')
      .update(patientId + this.dateShiftSalt)
      .digest('hex')
      .substring(0, 4);
    return (parseInt(hex, 16) % 365) + 1;
  }
}
