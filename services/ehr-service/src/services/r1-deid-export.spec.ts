/**
 * R1 / FX-001 (RES-003) red→green: de-id export INSERT must match the real
 * deid_export_log schema.
 *
 * Audit evidence: exportCohortDeidentified INSERTed
 * (exported_by, cohort_name, cohort_criteria, ..., purpose, approved_by)
 * but the bundle table is (id, cohort_id, requested_by, row_count,
 * download_token, exported_at) — live 500, C-034 path cannot complete.
 *
 * The fake db enforces the real column set and throws on unknown columns,
 * exactly as Postgres does. Red on the old INSERT, green after alignment.
 * Governance note for R6/FX-020: purpose/approved_by have no column to live
 * in after alignment — tracked in the fix commit body.
 */
import { DeidExportService } from './deid-export.service';

// Physical columns of bundle `deid_export_log` (verified via auditor).
const LOG_COLUMNS = new Set([
  'id', 'cohort_id', 'requested_by', 'row_count', 'download_token', 'exported_at',
]);

function schemaStrictDb() {
  const seen: string[] = [];
  return {
    seen,
    async query(sql: string, _params: any[]) {
      seen.push(sql);
      const m = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
      if (m && m[1] === 'deid_export_log') {
        for (const col of m[2].split(',').map((c) => c.trim())) {
          if (!LOG_COLUMNS.has(col)) {
            throw new Error(`column "${col}" does not exist`);
          }
        }
      }
      return [];
    },
  };
}

describe('R1 FX-001 RES-003 export log columns (red→green)', () => {
  it('inserts only real deid_export_log columns', async () => {
    const svc = new DeidExportService();
    const db: any = schemaStrictDb();
    const res = await svc.exportCohortDeidentified({
      cohortPatients: [{ id: 'p1', age: 34 }],
      fields: ['id', 'age'],
      exportedBy: 'u1',
      cohortName: 'c1',
      cohortCriteria: {},
      purpose: 'research',
      db,
    });
    expect(res.rowCount).toBe(1);
    expect(res.downloadToken).toHaveLength(64);
    const insert = db.seen.find((s: string) => /INSERT INTO deid_export_log/i.test(s));
    expect(insert).toBeDefined();
    expect(insert).toContain('requested_by');
    expect(insert).not.toContain('exported_by');
  });
});
