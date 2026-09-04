import { PrescriptionService } from './prescription.service';
import { PrescriptionStatus } from '../entities/prescription.entity';

describe('PrescriptionService', () => {
  // Regression test for the bug found 2026-09-04: create()'s raw INSERT
  // referenced 8 columns that have never existed in the real schema
  // (prescription_number, prescriber_id, generic_name, strength, form, route,
  // start_date, end_date, indication, pharmacy_notes), omitted the real NOT
  // NULL `duration` column entirely, and then read camelCase properties
  // (createdPrescription.patientId/.medicationName) off a raw snake_case
  // query result — every prescription-creation call has always failed.
  it('inserts only real prescriptions columns and returns a camelCase-mapped result', async () => {
    const insertedRow = {
      id: 'rx-1',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      medical_record_id: null,
      medication_name: 'Amlodipine',
      medication_name_snomed_code: null,
      medication_name_snomed_term: null,
      medication_name_snomed_module_id: null,
      medication_name_snomed_definition_status: null,
      dosage: '5mg',
      frequency: 'Once daily',
      duration: '30 days',
      quantity: 30,
      refills: 0,
      instructions: 'Take with food',
      is_controlled: false,
      controlled_schedule: null,
      status: PrescriptionStatus.ACTIVE,
      prescribed_date: new Date('2026-09-04T00:00:00.000Z'),
      created_at: new Date('2026-09-04T00:00:00.000Z'),
      updated_at: new Date('2026-09-04T00:00:00.000Z'),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT medication_name FROM prescriptions')) return [];
        if (sql.includes('SELECT allergen FROM allergies')) return [];
        if (sql.includes('INSERT INTO prescriptions')) return [insertedRow];
        return [];
      }),
    } as any;

    const terminologyService = {} as any;
    const cdssHookService = { handlePrescriptionCreated: jest.fn().mockResolvedValue(null) } as any;

    const service = new PrescriptionService(terminologyService, cdssHookService);

    const result = await service.create(
      {
        patientId: 'patient-1',
        medicationName: 'Amlodipine',
        dosage: '5mg',
        frequency: 'Once daily',
        duration: '30 days',
        quantity: 30,
        instructions: 'Take with food',
      },
      tenantDb,
      'doctor-1',
      'e2e-clinic',
    );

    const insertCall = tenantDb.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO prescriptions'));
    expect(insertCall[0]).not.toMatch(/prescription_number|prescriber_id|generic_name|strength|form|route|start_date|end_date|indication|pharmacy_notes/);
    expect(insertCall[0]).toMatch(/duration/);
    expect(insertCall[1]).toEqual([
      'patient-1', 'doctor-1', null, 'Amlodipine', null, null, null, null,
      '5mg', 'Once daily', '30 days', 30, 0, 'Take with food', false, null, PrescriptionStatus.ACTIVE,
    ]);

    expect(result.patientId).toBe('patient-1');
    expect(result.prescriberId).toBe('doctor-1');
    expect(result.medicationName).toBe('Amlodipine');
    expect(result.duration).toBe('30 days');
    expect(result.status).toBe(PrescriptionStatus.ACTIVE);
  });
});
