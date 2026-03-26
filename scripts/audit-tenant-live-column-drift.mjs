import { Client } from 'pg';

import { extractEntityTables } from './audit-tenant-provisioning.mjs';

function getBaseConfig() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medicore');
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

async function loadTargetTenants(master) {
  if (process.env.TENANT_DB) {
    return [process.env.TENANT_DB];
  }

  const { rows } = await master.query(
    `SELECT "databaseName"
     FROM tenants
     WHERE status = ANY($1)
     ORDER BY "databaseName"`,
    [['active', 'pending', 'suspended']],
  );

  return rows.map((row) => row.databaseName);
}

async function loadDatabaseColumns(config) {
  const client = new Client(config);
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );

    const tables = new Map();
    for (const row of rows) {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, new Set());
      }
      tables.get(row.table_name).add(row.column_name);
    }

    return tables;
  } finally {
    await client.end();
  }
}

async function main() {
  const entityTables = await extractEntityTables();
  const baseConfig = getBaseConfig();
  const master = new Client(baseConfig);
  await master.connect();

  try {
    const databases = await loadTargetTenants(master);
    const summaries = [];

    for (const databaseName of databases) {
      const databaseColumns = await loadDatabaseColumns({
        ...baseConfig,
        database: databaseName,
      });

      const missing = [];
      const extra = [];

      for (const [tableName, meta] of [...entityTables.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        const entityColumns = new Set(meta.columnDefinitions.map((column) => column.rawColumnName));
        const liveColumns = databaseColumns.get(tableName) ?? new Set();

        for (const columnName of entityColumns) {
          if (!liveColumns.has(columnName)) {
            missing.push(`${tableName}.${columnName}`);
          }
        }

        for (const columnName of liveColumns) {
          if (!entityColumns.has(columnName)) {
            extra.push(`${tableName}.${columnName}`);
          }
        }
      }

      summaries.push({
        databaseName,
        missingCount: missing.length,
        extraCount: extra.length,
        missing,
        extra,
      });
    }

    const ok = summaries.every((summary) => summary.missingCount === 0 && summary.extraCount === 0);
    console.log(
      JSON.stringify(
        {
          ok,
          databaseCount: summaries.length,
          summaries,
        },
        null,
        2,
      ),
    );

    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await master.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
