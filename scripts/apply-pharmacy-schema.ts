import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from '../services/tenant-service/src/services/database-provisioning.service';

async function main() {
  const masterUrl = process.env.DATABASE_URL || 'postgresql://medicore:medicore_password@localhost:5432/medicore_master';
  
  const master = new DataSource({ 
    type: 'postgres', 
    url: masterUrl,
    synchronize: false,
    logging: false,
  });
  
  await master.initialize();

  try {
    const tenants = await master.query(`
      SELECT id, "databaseName", "connectionString", subdomain 
      FROM tenants 
      WHERE status IN ('active', 'pending')
    `);
    
    const prov = new DatabaseProvisioningService(master);

    console.log(`📋 Found ${tenants.length} tenant(s) to update\n`);

    for (const t of tenants) {
      const conn = t.connectionString || 
        `postgresql://medicore:medicore_password@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${t.databaseName}`;
      
      console.log(`💊 Applying pharmacy schema to tenant: ${t.subdomain} (${t.databaseName})`);
      
      try {
        await prov.applyClinicSchema(conn, { 
          bundles: ['sprint8_pharmacy'],
          appliedBy: 'pharmacy_schema_script'
        });
        console.log(`✅ Successfully applied pharmacy schema to ${t.databaseName}\n`);
      } catch (error) {
        console.error(`❌ Failed to apply pharmacy schema to ${t.databaseName}:`, error instanceof Error ? error.message : String(error));
        console.log('');
      }
    }

    console.log('🎉 Completed applying pharmacy schema to all tenants');
  } finally {
    await master.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

