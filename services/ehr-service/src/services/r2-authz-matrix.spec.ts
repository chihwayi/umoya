// R2 / FX-011 + FX-012 RED: role × endpoint × relationship → allow/deny.
// The layer (PatientAccessService + disclosure gates) does not exist yet,
// so every positive/negative assertion here fails until it lands.
// afterAll emits remediation/AUTHZ_MATRIX.md FROM THIS RUN's outcomes.
import * as fs from 'fs';
import * as path from 'path';
import { PatientAccessService } from './patient-access.service';

type Ctx = 'stranger' | 'care-team' | 'appointment' | 'break-glass' | 'expired-break-glass';
interface Row {
  role: string;
  endpoint: string;
  ctx: Ctx;
  vip?: boolean;
  expect: 'allow' | 'deny';
}

const MATRIX: Row[] = [
  // FX-011: arbitrary-patient reads — the S-001 audit cases
  { role: 'receptionist', endpoint: 'REST GET /patients/:id', ctx: 'stranger', expect: 'deny' },
  { role: 'pharmacist', endpoint: 'REST GET /patients/:id', ctx: 'stranger', expect: 'deny' },
  { role: 'nurse', endpoint: 'REST GET /patients/:id', ctx: 'stranger', expect: 'deny' },
  { role: 'admin', endpoint: 'REST GET /patients/:id', ctx: 'stranger', expect: 'deny' },
  { role: 'receptionist', endpoint: 'FHIR GET /Patient/:id', ctx: 'stranger', expect: 'deny' },
  { role: 'nurse', endpoint: 'FHIR GET /Patient/:id/$everything', ctx: 'stranger', expect: 'deny' },
  { role: 'pharmacist', endpoint: 'FHIR search (changed ID)', ctx: 'stranger', expect: 'deny' },
  { role: 'receptionist', endpoint: 'census search', ctx: 'stranger', expect: 'deny' },
  // relationship grants access
  { role: 'nurse', endpoint: 'REST GET /patients/:id', ctx: 'care-team', expect: 'allow' },
  { role: 'doctor', endpoint: 'FHIR GET /Patient/:id/$everything', ctx: 'appointment', expect: 'allow' },
  { role: 'pharmacist', endpoint: 'FHIR search (changed ID)', ctx: 'care-team', expect: 'allow' },
  // break-glass
  { role: 'receptionist', endpoint: 'REST GET /patients/:id', ctx: 'break-glass', expect: 'allow' },
  { role: 'nurse', endpoint: 'REST GET /patients/:id', ctx: 'expired-break-glass', expect: 'deny' },
  // VIP: facility-admin bypass does NOT apply; relationship still works
  { role: 'admin', endpoint: 'REST GET /patients/:id', ctx: 'stranger', vip: true, expect: 'deny' },
  { role: 'doctor', endpoint: 'REST GET /patients/:id', ctx: 'care-team', vip: true, expect: 'allow' },
  { role: 'admin', endpoint: 'REST GET /patients/:id', ctx: 'care-team', vip: true, expect: 'allow' },
];

function fakeDb(scenario: { ctx: Ctx; vip: boolean }) {
  const patientId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  return {
    patientId,
    userId,
    query: async (sql: string, params: any[]) => {
      if (/FROM patients/.test(sql)) {
        return [
          {
            id: patientId,
            is_active: true,
            facility_id: null,
            vip_flag: scenario.vip,
            confidentiality_tier: scenario.vip ? 'restricted' : 'standard',
          },
        ];
      }
      if (/FROM users/.test(sql)) {
        return [{ id: userId, role: 'x', facility_id: null }];
      }
      if (/FROM patient_care_team/.test(sql)) {
        return scenario.ctx === 'care-team' ? [{ patient_id: patientId, user_id: userId, active: true }] : [];
      }
      if (/FROM appointments/.test(sql)) {
        return scenario.ctx === 'appointment' ? [{ id: 'a', status: 'scheduled' }] : [];
      }
      if (/FROM break_glass_access_log/.test(sql)) {
        // Emulate the SQL predicate (expires_at IS NULL OR expires_at > NOW()):
        // an expired grant matches zero rows in a real database.
        if (scenario.ctx === 'break-glass') {
          return [{ id: 'g', action: 'grant', expires_at: new Date(Date.now() + 3600_000).toISOString() }];
        }
        return [];
      }
      if (/INSERT INTO break_glass_access_log/.test(sql)) return [{ id: 'use-1' }];
      return [];
    },
  };
}

describe('R2 FX-011 access matrix (red→green)', () => {
  const outcomes: Array<Row & { got: string; pass: boolean }> = [];

  test.each(MATRIX.map((r, i) => [i, r] as const))('row %i: %s', async (_i, row) => {
    const db = fakeDb({ ctx: row.ctx, vip: !!row.vip }) as any;
    const svc = new PatientAccessService();
    const decision = await svc.canAccessPatient(
      db,
      { userId: db.userId, role: row.role, facilityId: null },
      db.patientId,
      'chart-read',
    );
    const got = decision.allowed ? 'allow' : 'deny';
    outcomes.push({ ...row, got, pass: got === row.expect });
    expect(got).toBe(row.expect);
  });

  afterAll(() => {
    const lines = [
      '# AUTHZ_MATRIX (generated from the r2-authz-matrix test run)',
      '',
      'Source: `services/ehr-service/src/services/r2-authz-matrix.spec.ts` — every row',
      'below is an executed assertion, not prose. Regenerate: `npx jest r2-authz-matrix`.',
      '',
      '| role | endpoint | context | VIP | expected | got |',
      '|---|---|---|---|---|---|',
      ...outcomes.map(
        (o) =>
          `| ${o.role} | ${o.endpoint} | ${o.ctx} | ${o.vip ? 'yes' : 'no'} | ${o.expect} | ${o.got} ${o.pass ? '' : 'FAIL'} |`,
      ),
    ];
    fs.writeFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'remediation', 'AUTHZ_MATRIX.md'),
      lines.join('\n') + '\n',
    );
  });
});
