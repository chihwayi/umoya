/**
 * R1 / FX-001+FX-012-interim (P-002/P-003) red→green: household disclosure
 * paths must not serve sensitive data to unauthorized roles — even after the
 * schema fix makes them reachable (a 500 becoming a leak would be a
 * regression, per the R1 brief's sequencing constraint).
 *
 * Interim rule (until R2/FX-012 lands consent-based disclosure): clinical
 * roles only (doctor/nurse/admin) on getFamilyPanel, getHouseholdAlerts and
 * propagateDiagnosis; everyone else gets ForbiddenException BEFORE any query.
 * Red: the service ignores the role and returns rows.
 */
import { HouseholdRiskService } from './household-risk.service';

function fakeDb(rows: any[] = [{ id: 'x', condition_name: 'HIV' }]) {
  let queries = 0;
  return {
    get calls() { return queries; },
    async query() { queries++; return rows; },
  };
}

describe('R1 household interim guard (red→green)', () => {
  const svc = new HouseholdRiskService();

  it.each(['receptionist', 'pharmacist', 'lab_tech', undefined])(
    'getFamilyPanel denies role %s without querying',
    async (role: any) => {
      const db: any = fakeDb();
      await expect(svc.getFamilyPanel(db, 'p1', role)).rejects.toThrow(/restricted to clinical roles/);
      expect(db.calls).toBe(0);
    },
  );

  it.each(['receptionist', 'pharmacist'])(
    'getHouseholdAlerts denies role %s without querying',
    async (role: any) => {
      const db: any = fakeDb();
      await expect(svc.getHouseholdAlerts(db, 'p1', role)).rejects.toThrow(/restricted to clinical roles/);
      expect(db.calls).toBe(0);
    },
  );

  it('propagateDiagnosis denies receptionist without querying', async () => {
    const db: any = fakeDb();
    await expect(svc.propagateDiagnosis(db, 'p1', 'HIV', 'receptionist')).rejects.toThrow(/restricted to clinical roles/);
    expect(db.calls).toBe(0);
  });

  it('doctor still reaches the data', async () => {
    const db: any = fakeDb([{ id: 'a' }]);
    await expect(svc.getFamilyPanel(db, 'p1', 'doctor')).resolves.toBeDefined();
    expect(db.calls).toBeGreaterThan(0);
  });
});
