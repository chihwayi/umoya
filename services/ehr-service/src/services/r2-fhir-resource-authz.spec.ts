// R2 gap-close RED: the enforcement seam every entry layer uses —
// assertResourceAccess (single reads) and filterResourcesByAccess (lists).
// Controllers pre-check through these WITHOUT changing getter/search
// signatures. Receptionist reading another patient's Observation/Condition
// by ID must be denied; a related clinician allowed.
import { FhirService } from './fhir.service';

function stubLayer(allow: boolean) {
  return {
    assertCanAccess: async () => {
      if (!allow) {
        const { ForbiddenException } = require('@nestjs/common');
        throw new ForbiddenException('Access denied: no established relationship to this patient');
      }
    },
    filterAccessiblePatientIds: async (_db: any, _acc: any, ids: string[]) => (allow ? ids : []),
  } as any;
}

// db.query serves the static owner-lookup SQL; getRepository is unused here.
function fakeDb(ownerByTable: Record<string, string>) {
  return {
    query: async (sql: string, params: any[]) => {
      const m = String(sql).match(/FROM (\w+)/);
      const owner = m ? ownerByTable[m[1]] : undefined;
      if (!owner) return [];
      if (/ANY\(\$1\)/.test(sql)) {
        return (params[0] as string[]).map((id) => ({ id, patient_id: owner }));
      }
      return [{ patient_id: owner }];
    },
    getRepository: () => ({ findOne: async () => null, find: async () => [] }),
  } as any;
}

const acc = (role: string) => ({ userId: 'u-recep', role, facilityId: null });

describe('R2 FHIR resource-level authorization (red→green)', () => {
  const OWNER = { vitals: 'p-other', problems: 'p-other', lab_orders: 'p-other' };

  test('receptionist denied reading another patient Observation by ID', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(false));
    await expect(
      svc.assertResourceAccess(fakeDb(OWNER), acc('receptionist'), 'Observation', '11111111-2222-3333-4444-555555555555-temp', 'chart-read'),
    ).rejects.toThrow(/denied|Forbidden|relationship/i);
  });

  test('related doctor allowed reading Observation (pre-check passes)', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(true));
    await expect(
      svc.assertResourceAccess(fakeDb({ vitals: 'p-own' }), acc('doctor'), 'Observation', '11111111-2222-3333-4444-555555555555-temp', 'chart-read'),
    ).resolves.toBeUndefined();
  });

  test('receptionist denied reading another patient Condition by ID', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(false));
    await expect(
      svc.assertResourceAccess(fakeDb(OWNER), acc('receptionist'), 'Condition', 'c1', 'chart-read'),
    ).rejects.toThrow(/denied|Forbidden|relationship/i);
  });

  test('related nurse allowed reading Condition (pre-check passes)', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(true));
    await expect(
      svc.assertResourceAccess(fakeDb({ problems: 'p-own' }), acc('nurse'), 'Condition', 'c1', 'chart-read'),
    ).resolves.toBeUndefined();
  });

  test('directory resources (Medication) pass through without patient scope', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(false));
    await expect(
      svc.assertResourceAccess(fakeDb({}), acc('receptionist'), 'Medication', 'm1', 'chart-read'),
    ).resolves.toBeUndefined();
  });

  test('search lists filter to accessible owners only', async () => {
    const svc = new FhirService(undefined, undefined, stubLayer(true));
    const db = fakeDb({ problems: 'p-own' });
    // stub allows everything here; the mechanism (owner resolution + layer
    // filter) is what is exercised — denial parity covered above.
    const kept = await svc.filterResourcesByAccess(db, acc('doctor'), 'Condition', ['c1', 'c2']);
    expect(kept).toEqual(['c1', 'c2']);
  });
});
