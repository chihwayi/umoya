// R2 / FX-011 + FX-012 RED: role × endpoint × relationship → allow/deny.
// The layer (PatientAccessService + disclosure gates) does not exist yet,
// so every positive/negative assertion here fails until it lands.
// afterAll emits remediation/AUTHZ_MATRIX.md FROM THIS RUN's outcomes.
import * as fs from 'fs';
import * as path from 'path';
import { PatientAccessService } from './patient-access.service';
import { HouseholdRiskService } from './household-risk.service';
import { scrubConditionTerms } from '../utils/condition-scrub.util';
import { ENTITY_TO_TABLE as SYNC_ALLOWLIST } from '../controllers/offline-sync.controller';

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
  const seenRows = new Set<string>();
  const record = (role: string, endpoint: string, ctx: string, expect: string, got: string) => {
    const key = `${role}|${endpoint}|${ctx}`;
    if (seenRows.has(key)) return;
    seenRows.add(key);
    outcomes.push({ role, endpoint, ctx: ctx as any, expect: expect as any, got: got as any, pass: expect === got });
  };

  test('receptionist denied Observation by ID (resource seam)', async () => {
    const { FhirService } = require('./fhir.service');
    const denyLayer = {
      assertCanAccess: async () => {
        throw new (require('@nestjs/common').ForbiddenException)('no relationship');
      },
      filterAccessiblePatientIds: async () => [],
    };
    const svc = new FhirService(undefined, undefined, denyLayer);
    const db: any = {
      query: async (sql: string) =>
        /FROM vitals/.test(sql) ? [{ patient_id: 'p-other' }] : [],
    };
    await expect(
      svc.assertResourceAccess(db, { userId: 'u', role: 'receptionist', facilityId: null }, 'Observation', '11111111-2222-3333-4444-555555555555-temp', 'chart-read'),
    ).rejects.toThrow(/relationship|denied|Forbidden/i);
    record('receptionist', 'FHIR Observation read', 'stranger', 'deny', 'deny');
  });

  test('receptionist denied Condition by ID (resource seam)', async () => {
    const { FhirService } = require('./fhir.service');
    const denyLayer = {
      assertCanAccess: async () => {
        throw new (require('@nestjs/common').ForbiddenException)('no relationship');
      },
      filterAccessiblePatientIds: async () => [],
    };
    const svc = new FhirService(undefined, undefined, denyLayer);
    const db: any = {
      query: async (sql: string) =>
        /FROM problems/.test(sql) ? [{ patient_id: 'p-other' }] : [],
    };
    await expect(
      svc.assertResourceAccess(db, { userId: 'u', role: 'receptionist', facilityId: null }, 'Condition', 'c1', 'chart-read'),
    ).rejects.toThrow(/relationship|denied|Forbidden/i);
    record('receptionist', 'FHIR Condition read', 'stranger', 'deny', 'deny');
  });

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

  // ── FX-012 disclosure rows (consent-gated propagation, age-gated reads,
  // scrubbed payloads, de-allowlisted sync). Shared fake: scenario selects
  // which queries return rows.
  describe('FX-012 disclosure consent + age + scrub + sync (red→green)', () => {
    // Constructed the way ehr.module does (layer injected); the R1 spec's
    // bare `new HouseholdRiskService()` still denies fail-closed, just with
    // a different message — covered by the receptionist zero-query test.
    const svc = new HouseholdRiskService(new PatientAccessService());
    function dfake(scenario: {
      consent?: 'active' | 'withdrawn' | 'none';
      safeguard?: boolean;
      minor?: boolean;
    }) {
      const inserts: string[] = [];
      return {
        inserts,
        query: async (sql: string, _p: any[]) => {
          if (/INSERT INTO household_alerts/.test(sql)) { inserts.push('household_alerts'); return [{ id: 'al1' }]; }
          if (/INSERT INTO household_disclosure_consents/.test(sql)) return [{ id: 'dc1' }];
          if (/FROM household_disclosure_consents/.test(sql)) {
            // Emulate the SQL predicates (status/withdrawn/expires): a
            // withdrawn consent matches zero rows in a real database.
            if (scenario.consent === 'active') return [{ id: 'dc1', status: 'active' }];
            return [];
          }
          if (/do_not_notify/.test(sql)) return scenario.safeguard ? [{ do_not_notify: true }] : [];
          if (/FROM patients/.test(sql)) {
            return [{
              id: 'p1', household_id: 'h1', is_active: true, facility_id: null,
              vip_flag: false, confidentiality_tier: 'standard',
              date_of_birth: scenario.minor ? '2015-01-01' : '1990-01-01',
            }];
          }
          if (/FROM users/.test(sql)) return [{ id: 'u1', role: 'x', facility_id: null }];
          if (/FROM patient_care_team/.test(sql) || /FROM appointments/.test(sql)) return [];
          if (/FROM break_glass_access_log/.test(sql)) return [];
          return [];
        },
      };
    }
    const acc = (role: string) => ({ userId: 'u1', role, facilityId: null });
    // record() lives in the outer describe; FX-012 rows reuse it.
    test('propagation without consent creates zero alerts and no INSERT', async () => {
      const db: any = dfake({ consent: 'none' });
      const res = await svc.propagateDiagnosis(db, 'p1', 'HIV', acc('doctor'));
      expect(res.alertsCreated).toBe(0);
      expect(res.blockedReason).toMatch(/consent/);
      expect(db.inserts).not.toContain('household_alerts');
      record('doctor', 'household propagate (HIV)', 'no-consent', 'deny', 'deny');
    });

    test('propagation with active consent creates the alert', async () => {
      const db: any = dfake({ consent: 'active' });
      const res = await svc.propagateDiagnosis(db, 'p1', 'HIV', acc('doctor'));
      expect(res.alertsCreated).toBe(1);
      expect(db.inserts).toContain('household_alerts');
      record('doctor', 'household propagate (HIV)', 'active-consent', 'allow', 'allow');
    });

    test('withdrawn consent blocks propagation', async () => {
      const db: any = dfake({ consent: 'withdrawn' });
      const res = await svc.propagateDiagnosis(db, 'p1', 'HIV', acc('doctor'));
      expect(res.alertsCreated).toBe(0);
      expect(res.blockedReason).toMatch(/consent/);
      expect(db.inserts).not.toContain('household_alerts');
      record('doctor', 'household propagate (HIV)', 'withdrawn-consent', 'deny', 'deny');
    });

    test('safeguard flag blocks even with active consent', async () => {
      const db: any = dfake({ consent: 'active', safeguard: true });
      const res = await svc.propagateDiagnosis(db, 'p1', 'HIV', acc('doctor'));
      expect(res.alertsCreated).toBe(0);
      expect(res.blockedReason).toMatch(/safeguard|do-not-notify|unsafe/);
      record('doctor', 'household propagate (HIV)', 'safeguard+consent', 'deny', 'deny');
    });

    test('receptionist accessor denied before any query', async () => {
      const db: any = dfake({ consent: 'active' });
      let queries = 0;
      const counting: any = { query: async (...a: any[]) => { queries++; return db.query(...a); } };
      await expect(svc.getFamilyPanel(counting, 'p1', acc('receptionist'))).rejects.toThrow(
        /restricted to clinical roles/,
      );
      expect(queries).toBe(0);
      record('receptionist', 'household family panel', 'stranger', 'deny', 'deny');
    });

    test('doctor accessor without relationship denied by the layer', async () => {
      const db: any = dfake({ consent: 'active' });
      await expect(svc.getFamilyPanel(db, 'p1', acc('doctor'))).rejects.toThrow(/relationship/);
      record('doctor', 'household family panel', 'no-relationship', 'deny', 'deny');
    });

    test('minor patient alerts read denied for admin accessor', async () => {
      const db: any = dfake({ consent: 'active', minor: true });
      await expect(svc.getHouseholdAlerts(db, 'p1', acc('admin'))).rejects.toThrow(
        /adolescent|minor|assent/i,
      );
      record('admin', 'household alerts (minor patient)', 'stranger', 'deny', 'deny');
    });

    test.each([
      ['Umoya: your household contact was diagnosed with HIV, come to clinic', 'HIV'],
      ['TB screening for household contact of TB patient', 'TB'],
    ])('SMS scrub removes condition %s', (msg, term) => {
      const out = scrubConditionTerms(msg);
      expect(out).not.toMatch(new RegExp(term, 'i'));
      expect(out).toMatch(/removed|app/i);
      record('any-role', 'SMS send (condition text)', 'free-text', 'deny', 'deny');
    });

    test('SMS scrub leaves clean messages untouched', () => {
      const msg = 'Umoya: Hi Amina, your care team left you a message. Please open the app.';
      expect(scrubConditionTerms(msg)).toBe(msg);
      record('any-role', 'SMS send (clean text)', 'free-text', 'allow', 'allow');
    });

    test('disclosure records are off the offline sync allowlist', () => {
      expect(SYNC_ALLOWLIST).not.toHaveProperty('hiv_disclosure_records');
      record('any-role', 'offline sync hiv_disclosure_records', 'n/a', 'deny', 'deny');
    });
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
