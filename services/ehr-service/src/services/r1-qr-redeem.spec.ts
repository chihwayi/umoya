/**
 * R1 / FX-001 (P-001) red→green: QR redeem must not select the phantom `mrn` column.
 *
 * Audit evidence: redeemCheckinToken raw SQL selected `mrn` from patients, but
 * the physical column is `patient_number` (`mrn` is a JS-only getter on the
 * entity) — live 500 "column mrn does not exist", QR check-in 100% broken.
 *
 * The fake tenantDb below enforces the real post-R1 bundle schema: any SELECT
 * naming a column absent from the known-good set throws exactly as Postgres
 * does. Red on the old SQL, green after `patient_number AS mrn`.
 */
import { CheckinService } from './checkin.service';

// Physical columns of bundle `patients` (post-R1; mirrors information_schema).
const PATIENT_COLUMNS = new Set([
  'id', 'patient_number', 'first_name', 'last_name', 'date_of_birth', 'gender',
  'id_number', 'phone', 'email', 'address', 'city', 'emergency_contact_name',
  'emergency_contact_phone', 'medical_aid_name', 'medical_aid_number',
  'medical_aid_plan', 'blood_type', 'allergies', 'chronic_conditions',
  'is_active', 'created_at', 'updated_at', 'confidentiality_tier',
  'deceased_at', 'vip_flag', 'latest_risk_level', 'household_id',
]);

function schemaStrictDb() {
  const seen: string[] = [];
  return {
    seen,
    async query(sql: string, _params: any[]) {
      seen.push(sql);
      if (/FROM patients/i.test(sql)) {
        const cols = sql
          .split(/FROM/i)[0]
          .replace(/SELECT/i, '')
          .split(',')
          .map((c) => c.trim().split(/\s+/)[0].replace(/^[a-z_]+\./i, '').replace(/"/g, ''));
        for (const c of cols) {
          if (c !== '*' && !PATIENT_COLUMNS.has(c)) {
            throw new Error(`column "${c}" does not exist`);
          }
        }
        return [{ id: 'p1', first_name: 'R', last_name: 'T', mrn: 'PN-1', date_of_birth: '1990-01-01', gender: 'female' }];
      }
      if (/FROM patient_checkin_tokens/i.test(sql)) {
        if (/^SELECT/i.test(sql.trim())) {
          return [{ id: 't1', patient_id: 'p1', appointment_id: null }];
        }
        return [];
      }
      if (/FROM appointments/i.test(sql)) return [];
      return [];
    },
  };
}

describe('R1 FX-001 P-001 QR redeem column (red→green)', () => {
  it('redeems without selecting a phantom mrn column', async () => {
    const svc = new CheckinService();
    const db: any = schemaStrictDb();
    const res = await svc.redeemCheckinToken(db, 'raw-token-that-hashes', 'user1');
    expect(res.patientId).toBe('p1');
    const patientSelect = db.seen.find((s: string) => /FROM patients/i.test(s));
    expect(patientSelect).toBeDefined();
    expect(patientSelect).toContain('patient_number AS mrn');
    expect(patientSelect).not.toMatch(/,\s*mrn\s*,/);
    expect(res.patient.mrn).toBe('PN-1');
  });
});
