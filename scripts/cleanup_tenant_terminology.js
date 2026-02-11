const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const masterPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medicore',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function cleanup() {
  const client = await masterPool.connect();
  try {
    console.log('Fetching tenants from master database...');
    const res = await client.query('SELECT * FROM tenants');
    const tenants = res.rows;
    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
      const dbName = tenant.database_name || tenant.databaseName || tenant.databasename;
      const tenantName = tenant.clinic_name || tenant.clinicName || tenant.name;
      
      if (!dbName) {
        console.warn(`⚠️ Skipping tenant with no database name: ${JSON.stringify(tenant)}`);
        continue;
      }

      console.log(`\nProcessing tenant: ${tenantName} (${dbName})...`);
      
      const tenantPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: dbName,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      let tenantClient;
      try {
        tenantClient = await tenantPool.connect();
        const tablesToDrop = [
          'snomed_icd10_mappings',
          'icd10_mapping_metadata',
          'snomed_concepts',
          'snomed_descriptions',
          'snomed_relationships',
          'icd10_codes'
        ];

        for (const table of tablesToDrop) {
          const checkRes = await tenantClient.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            );
          `, [table]);

          if (checkRes.rows[0].exists) {
            console.log(`  Found table ${table}. Dropping...`);
            await tenantClient.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
            console.log(`  ✅ Dropped ${table}`);
          } else {
            // console.log(`  Table ${table} not found (Good).`);
          }
        }
        
        // Remove from schema versions
        await tenantClient.query("DELETE FROM tenant_schema_versions WHERE bundle_id = 'icd10_mapping'");

      } catch (err) {
        console.error(`  ❌ Error processing tenant ${tenantName}:`, err.message);
      } finally {
        if (tenantClient) tenantClient.release();
        await tenantPool.end();
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await masterPool.end();
  }
}

cleanup();
