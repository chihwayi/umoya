import 'reflect-metadata';

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';

import { DatabaseProvisioningService } from '../services/tenant-service/dist/services/database-provisioning.service.js';

const ROOT = process.cwd();
const TENANT_SERVICE_SOURCE_PATH = path.join(
  ROOT,
  'services/ehr-service/src/services/tenant.service.ts',
);
const EHR_SERVICE_DIST_PATH = path.join(ROOT, 'services/ehr-service/dist');

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function getMasterConnectionOptions(databaseOverride) {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres',
      url: databaseOverride
        ? process.env.DATABASE_URL.replace(/\/([^/?#]+)(\?.*)?$/, `/${databaseOverride}$2`)
        : process.env.DATABASE_URL,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseOverride || process.env.DB_NAME || 'medicore',
  };
}

async function getTenantEntityRegistry() {
  const source = await fs.readFile(TENANT_SERVICE_SOURCE_PATH, 'utf8');
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+'(\.\.\/entities\/[^']+)';/g;
  const importMap = new Map();

  for (const match of source.matchAll(importRegex)) {
    const importedNames = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const distRelativePath = match[2]
      .replace('../entities/', 'entities/')
      .replace(/\.entity$/, '.entity');
    const absolutePath = path.join(EHR_SERVICE_DIST_PATH, `${distRelativePath}.js`);

    for (const importedName of importedNames) {
      importMap.set(importedName, absolutePath);
    }
  }

  const entitiesBlockMatch = source.match(/entities:\s*\[([\s\S]*?)\]\s*,\s*logging:/);
  if (!entitiesBlockMatch) {
    throw new Error('Could not locate tenant entity registry in tenant.service.ts');
  }

  const entityNames = entitiesBlockMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z_]\w*$/.test(entry));

  return {
    entityNames: [...new Set(entityNames)],
    importMap,
  };
}

async function loadTenantEntities() {
  const { entityNames, importMap } = await getTenantEntityRegistry();
  const moduleCache = new Map();
  const entities = [];

  for (const entityName of entityNames) {
    const filePath = importMap.get(entityName);
    if (!filePath) {
      throw new Error(`Missing import path for entity ${entityName}`);
    }

    let moduleExports = moduleCache.get(filePath);
    if (!moduleExports) {
      moduleExports = await import(pathToFileURL(filePath).href);
      moduleCache.set(filePath, moduleExports);
    }

    const target = moduleExports[entityName];
    if (!target) {
      throw new Error(`Entity ${entityName} was not exported from ${filePath}`);
    }

    entities.push({
      name: entityName,
      target,
    });
  }

  return entities;
}

async function createTenantDataSource(databaseName, entities) {
  const options = getMasterConnectionOptions(databaseName);
  const dataSource = new DataSource({
    ...options,
    synchronize: false,
    logging: false,
    entities: entities.map((entity) => entity.target),
  });

  await dataSource.initialize();
  return dataSource;
}

function renderQuery(query) {
  if (!query.parameters || query.parameters.length === 0) {
    return query.query;
  }

  return `${query.query} /* params: ${JSON.stringify(query.parameters)} */`;
}

async function getSchemaDrift(databaseName, entities) {
  const dataSource = await createTenantDataSource(databaseName, entities);

  try {
    const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
    return {
      databaseName,
      queryCount: sqlInMemory.upQueries.length,
      queries: sqlInMemory.upQueries.map((query) => renderQuery(query)),
    };
  } finally {
    await dataSource.destroy();
  }
}

async function createScratchDatabase(master) {
  const databaseName = `tenant_schema_audit_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  await master.query(`CREATE DATABASE "${databaseName}"`);
  return databaseName;
}

async function dropScratchDatabase(master, databaseName) {
  await master.query(
    `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
    `,
    [databaseName],
  );
  await master.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
}

function buildTenantConnectionUrl(databaseName) {
  return `postgresql://${encodeURIComponent(
    process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
  )}:${encodeURIComponent(
    process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  )}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5432'}/${databaseName}`;
}

async function auditProvisioning(master, entities) {
  const provisioning = new DatabaseProvisioningService(master);
  const databaseName = await createScratchDatabase(master);

  try {
    await provisioning.applyClinicSchema(buildTenantConnectionUrl(databaseName), {
      strict: true,
      appliedBy: 'typeorm_drift_audit',
    });
    return await getSchemaDrift(databaseName, entities);
  } finally {
    await dropScratchDatabase(master, databaseName);
  }
}

async function getTargetTenantDatabases(master) {
  if (process.env.TENANT_DB) {
    return [process.env.TENANT_DB];
  }

  const rows = await master.query(
    `SELECT "databaseName" FROM tenants WHERE status IN ('active', 'pending', 'suspended') ORDER BY "databaseName"`,
  );
  return rows.map((row) => row.databaseName);
}

async function main() {
  const entities = await loadTenantEntities();
  const master = new DataSource(getMasterConnectionOptions());
  await master.initialize();

  try {
    const includeProvisioning = parseBooleanEnv(process.env.AUDIT_PROVISIONING, true);
    const includeTenants = parseBooleanEnv(process.env.AUDIT_TENANTS, true);
    const tenantLimit = process.env.AUDIT_TENANT_LIMIT
      ? Number(process.env.AUDIT_TENANT_LIMIT)
      : null;

    const result = {
      ok: true,
      entityCount: entities.length,
    };

    if (includeProvisioning) {
      result.provisioning = await auditProvisioning(master, entities);
      result.ok = result.ok && result.provisioning.queryCount === 0;
    }

    if (includeTenants) {
      const tenantDatabases = await getTargetTenantDatabases(master);
      const selectedDatabases =
        tenantLimit && tenantLimit > 0 ? tenantDatabases.slice(0, tenantLimit) : tenantDatabases;
      const driftSummaries = [];

      for (const databaseName of selectedDatabases) {
        driftSummaries.push(await getSchemaDrift(databaseName, entities));
      }

      result.tenants = driftSummaries;
      result.ok = result.ok && driftSummaries.every((summary) => summary.queryCount === 0);
    }

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await master.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
