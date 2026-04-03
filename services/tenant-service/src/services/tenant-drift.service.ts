import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TENANT_ENTITY_ALIGNMENT_STATEMENTS } from '../generated/tenant-entity-alignment.statements';

export interface ColumnDrift {
  tableName: string;
  missingColumns: string[];
}

export interface DriftReport {
  ok: boolean;
  checkedAt: string;
  tableCount: number;
  missingTableCount: number;
  missingColumnTableCount: number;
  missingTables: string[];
  tablesWithMissingColumns: ColumnDrift[];
}

export interface RepairOutcome {
  attempts: number;
  before: DriftReport;
  after: DriftReport;
  resolved: boolean;
}

@Injectable()
export class TenantDriftService {
  private readonly logger = new Logger(TenantDriftService.name);

  /** Parse alignment statements into expected {table → Set<column>} */
  private buildExpectedSchema(): { tables: Set<string>; columns: Map<string, Set<string>> } {
    const tables = new Set<string>();
    const columns = new Map<string, Set<string>>();

    for (const stmt of TENANT_ENTITY_ALIGNMENT_STATEMENTS) {
      // CREATE TABLE IF NOT EXISTS table_name
      const createMatch = stmt.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      if (createMatch) {
        const t = createMatch[1].toLowerCase();
        tables.add(t);
        if (!columns.has(t)) columns.set(t, new Set());
      }

      // ALTER TABLE t ADD COLUMN IF NOT EXISTS col_name ...
      // Every column appears as its own ALTER TABLE statement (generated format)
      const alterMatch = stmt.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      if (alterMatch) {
        const t = alterMatch[1].toLowerCase();
        const c = alterMatch[2].toLowerCase();
        tables.add(t);
        if (!columns.has(t)) columns.set(t, new Set());
        columns.get(t)!.add(c);
      }
    }

    return { tables, columns };
  }

  async checkDrift(connectionString: string): Promise<DriftReport> {
    const ds = new DataSource({
      name: `drift_check_${Date.now()}`,
      type: 'postgres',
      url: connectionString,
    });

    try {
      await ds.initialize();

      const rows: Array<{ table_name: string; column_name: string }> = await ds.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, column_name`,
      );

      const actual = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
        actual.get(row.table_name)!.add(row.column_name.toLowerCase());
      }

      const { tables: expectedTables, columns: expectedColumns } = this.buildExpectedSchema();

      const missingTables: string[] = [];
      const tablesWithMissingColumns: ColumnDrift[] = [];

      for (const table of expectedTables) {
        if (!actual.has(table)) {
          missingTables.push(table);
          continue;
        }
        const actualCols = actual.get(table)!;
        const expectedCols = expectedColumns.get(table) ?? new Set<string>();
        const missing = [...expectedCols].filter((c) => !actualCols.has(c));
        if (missing.length > 0) {
          tablesWithMissingColumns.push({ tableName: table, missingColumns: missing });
        }
      }

      return {
        ok: missingTables.length === 0 && tablesWithMissingColumns.length === 0,
        checkedAt: new Date().toISOString(),
        tableCount: expectedTables.size,
        missingTableCount: missingTables.length,
        missingColumnTableCount: tablesWithMissingColumns.length,
        missingTables,
        tablesWithMissingColumns,
      };
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }

  async autoRepairWithCheck(
    connectionString: string,
    runRepair: (conn: string) => Promise<void>,
    maxAttempts = 2,
  ): Promise<RepairOutcome> {
    const before = await this.checkDrift(connectionString);

    if (before.ok) {
      return { attempts: 0, before, after: before, resolved: true };
    }

    let after = before;
    let attempts = 0;

    while (!after.ok && attempts < maxAttempts) {
      attempts += 1;
      this.logger.log(`Drift auto-repair attempt ${attempts}/${maxAttempts}`);
      try {
        await runRepair(connectionString);
      } catch (err) {
        this.logger.error(`Repair attempt ${attempts} error: ${err instanceof Error ? err.message : err}`);
        break;
      }
      after = await this.checkDrift(connectionString);
    }

    return { attempts, before, after, resolved: after.ok };
  }
}
