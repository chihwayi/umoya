/**
 * R1 / FX-001+FX-020-interim (RES-004) red→green: cohort row-returning paths
 * are suspended until R6 lands the authorization layer — RES-004 proved the
 * builder returns identified rows to any role, and fixing the schema must not
 * reactivate that leak. runCohort/runSavedCohort throw 503 with an explicit
 * R6 pointer and never touch the database.
 * Red: the service runs the query and returns rows.
 */
import { CohortBuilderService } from './cohort-builder.service';

describe('R1 cohort interim gate (red→green)', () => {
  const svc = new CohortBuilderService();

  it('runCohort refuses with 503 before querying', async () => {
    let queries = 0;
    const db: any = { async query() { queries++; return [{ id: 'p1' }]; } };
    await expect(svc.runCohort({ conditions: [], logic: 'AND' }, db)).rejects.toThrow(/R6/);
    expect(queries).toBe(0);
  });

  it('runSavedCohort refuses with 503 before querying', async () => {
    let queries = 0;
    const db: any = { async query() { queries++; return [{ id: 'p1' }]; } };
    await expect(svc.runSavedCohort('c1', db)).rejects.toThrow(/R6/);
    expect(queries).toBe(0);
  });
});
