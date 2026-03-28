import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from '../services/database-provisioning.service';

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
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

async function main() {
  const masterUrl = process.env.DATABASE_URL;
  if (!masterUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const strict = parseBooleanEnv(process.env.REPAIR_STRICT, true);

  const master = new DataSource({ type: 'postgres', url: masterUrl });
  await master.initialize();

  try {
    const tenants = await master.query('SELECT id, "databaseName", "connectionString" FROM tenants WHERE status IN (\'active\', \'pending\', \'suspended\')');
    const prov = new DatabaseProvisioningService(master);
    const successes: Array<{ id: string; databaseName: string }> = [];
    const failures: Array<{ id: string; databaseName: string; error: string }> = [];

    for (const t of tenants) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const user = encodeURIComponent(process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres');
      const pass = encodeURIComponent(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres');
      // Always build from env so repair works from host (DB_HOST=localhost) or in-docker (DB_HOST=postgres-master)
      const conn = `postgresql://${user}:${pass}@${host}:${port}/${t.databaseName}`;
      console.log(`Applying clinic schema to tenant ${t.id} (${t.databaseName}) [strict=${strict}]`);

      try {
        const result = await prov.applyClinicSchema(conn, {
          strict,
          appliedBy: 'repair_tenants_script',
        });

        if (result.pendingBundles.length > 0) {
          const message = result.pendingBundles
            .map((bundle) => `${bundle.bundleId} (${bundle.lastError})`)
            .join('; ');
          failures.push({
            id: t.id,
            databaseName: t.databaseName,
            error: message,
          });
          console.error(`⚠️ Tenant ${t.id} (${t.databaseName}) still has unresolved bundles: ${message}`);
        } else {
          successes.push({
            id: t.id,
            databaseName: t.databaseName,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({
          id: t.id,
          databaseName: t.databaseName,
          error: message,
        });
        console.error(`❌ Tenant ${t.id} (${t.databaseName}) repair failed: ${message}`);

        if (strict) {
          throw error;
        }
      }
    }

    console.log(`✅ Completed applying schema to ${successes.length} tenant(s)`);

    if (failures.length > 0) {
      console.error(`⚠️ ${failures.length} tenant(s) still have unresolved provisioning errors`);
      for (const failure of failures) {
        console.error(`- ${failure.id} (${failure.databaseName}): ${failure.error}`);
      }

      if (strict) {
        process.exitCode = 1;
      }
    }
  } finally {
    await master.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
