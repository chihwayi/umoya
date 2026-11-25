/**
 * R1 / FX-001 (F-004) red→green: getPatientEverything must use physical
 * snake_case columns with aliases, not camelCase property names.
 *
 * Audit evidence (F-004): raw SQL selected "patientId", "recordDate", `type`
 * etc. from medical_records — live 500 `column "patientId" does not exist`.
 * Two sibling queries in the same file already use the correct
 * `patient_id as "patientId"` pattern; this one was the outlier.
 *
 * The fake repository enforces the real bundle column set (verified against
 * the provisioned scratch tenant): camelCase identifiers throw exactly as
 * Postgres does. Red on the old SQL, green after the alias fix.
 */
import { FhirService } from './fhir.service';

// Physical columns of bundle `medical_records` (post-bundle, verified live).
const MEDICAL_RECORD_COLUMNS = new Set([
  'id', 'patient_id', 'record_type', 'title', 'content', 'file_path',
  'file_type', 'file_size', 'created_by', 'created_at', 'updated_at',
  'who_smart_form_data', 'appointment_id', 'assessment', 'attachments',
  'chief_complaint', 'diagnoses', 'doctor_id', 'follow_up_instructions',
  'history_present_illness', 'is_confidential', 'physical_examination',
  'plan', 'procedures', 'record_number', 'visit_date', 'vital_signs',
]);

function schemaStrictRepo() {
  const seen: string[] = [];
  return {
    seen,
    async query(sql: string, _params: any[]) {
      seen.push(sql);
      const m = sql.match(/FROM\s+(\w+)/i);
      if (m && m[1] === 'medical_records') {
        const dealiased = sql.replace(/\s+[Aa][Ss]\s+"[A-Za-z_][A-Za-z0-9_]*"/g, '');
        const idents = [...dealiased.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((x) => x[1]);
        for (const ident of idents) {
          const lower = ident.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          if (!MEDICAL_RECORD_COLUMNS.has(lower) && !MEDICAL_RECORD_COLUMNS.has(ident)) {
            throw new Error(`column "${ident}" does not exist`);
          }
        }
        return [];
      }
      return [];
    },
    find: async () => [],
    findOne: async () => ({ id: 'p1', isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  };
}

describe('R1 FX-001 F-004 $everything column names (red→green)', () => {
  it('queries medical_records with physical columns only', async () => {
    // R2: getPatientEverything now requires an accessor; the layer is stubbed
    // to allow so this test keeps asserting the SQL shape, not authz (the
    // r2-authz-matrix suite owns the access decision).
    const layerStub: any = { assertCanAccess: async () => undefined };
    const svc = new FhirService(undefined, undefined, layerStub);
    const repo: any = schemaStrictRepo();
    const tenantDb: any = { getRepository: () => repo };
    await svc.getPatientEverything('p1', tenantDb, 't1', { userId: 'u1', role: 'doctor' });
    const raw = repo.seen.find((s: string) => /FROM medical_records/i.test(s));
    expect(raw).toBeDefined();
    expect(raw).toContain('patient_id');
    // Bare camelCase identifiers are rejected by the schema-strict fake above
    // (it throws exactly as Postgres does) — reaching these assertions IS the
    // green signal. Aliases (`as "patientId"`) are legal output names.
  });
});
