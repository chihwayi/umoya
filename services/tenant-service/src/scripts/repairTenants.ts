import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from '../services/database-provisioning.service';

async function main() {
  const masterUrl = process.env.DATABASE_URL;
  if (!masterUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const master = new DataSource({ type: 'postgres', url: masterUrl });
  await master.initialize();

  try {
    const tenants = await master.query('SELECT id, "databaseName", "connectionString" FROM tenants WHERE status IN (\'active\', \'pending\', \'suspended\')');
    const prov = new DatabaseProvisioningService(master);

    for (const t of tenants) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const user = encodeURIComponent(process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres');
      const pass = encodeURIComponent(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres');
      // Always build from env so repair works from host (DB_HOST=localhost) or in-docker (DB_HOST=postgres-master)
      const conn = `postgresql://${user}:${pass}@${host}:${port}/${t.databaseName}`;
      console.log(`Applying clinic schema to tenant ${t.id} (${t.databaseName})`);
      await prov.applyClinicSchema(conn);
    }

    console.log('✅ Completed applying schema to all tenants');
  } finally {
    await master.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

