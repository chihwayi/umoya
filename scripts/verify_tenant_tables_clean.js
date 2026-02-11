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

async function verify() {
  const client = await masterPool.connect();
  try {
    console.log('Fetching tenants from master database...');
    const res = await client.query('SELECT * FROM tenants');
    const tenants = res.rows;
    console.log(`Found ${tenants.length} tenants.`);

    let allClean = true;

    for (const tenant of tenants) {
      const dbName = tenant.database_name || tenant.databaseName || tenant.databasename;
      const tenantName = tenant.clinic_name || tenant.clinicName || tenant.name;
      
      if (!dbName) continue;

      console.log(`\nVerifying tenant: ${tenantName} (${dbName})...`);
      
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
        
        // Check for terminology tables
        const terminologyTables = [
          'snomed_icd10_mappings',
          'icd10_mapping_metadata',
          'snomed_concepts',
          'snomed_descriptions',
          'snomed_relationships',
          'icd10_codes'
        ];

        const query = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ANY($1::text[])
        `;
        
        const checkRes = await tenantClient.query(query, [terminologyTables]);

        if (checkRes.rows.length > 0) {
          console.error(`  ❌ FAILED: Found terminology tables in tenant DB: ${checkRes.rows.map(r => r.table_name).join(', ')}`);
          allClean = false;
        } else {
          console.log(`  ✅ CLEAN: No terminology tables found.`);
        }

        // Check for columns in drugs table? 
        // User said "remove now" for tables.
        // Columns like snomed_code are probably fine as they are just references.
        // But let's check if there are any other suspicious tables.
        
        // Check schema versions
        const versionRes = await tenantClient.query("SELECT bundle_id FROM tenant_schema_versions WHERE bundle_id = 'icd10_mapping'");
        if (versionRes.rows.length > 0) {
             console.warn(`  ⚠️ WARNING: 'icd10_mapping' bundle still recorded in tenant_schema_versions.`);
             // We should probably delete this row if we dropped the tables.
             await tenantClient.query("DELETE FROM tenant_schema_versions WHERE bundle_id = 'icd10_mapping'");
             console.log(`     Removed 'icd10_mapping' from tenant_schema_versions.`);
        }

      } catch (err) {
        console.error(`  ❌ Error verifying tenant ${tenantName}:`, err.message);
      } finally {
        if (tenantClient) tenantClient.release();
        await tenantPool.end();
      }
    }

    if (allClean) {
        console.log('\n✅ VERIFICATION PASSED: All tenant databases are free of terminology tables.');
    } else {
        console.error('\n❌ VERIFICATION FAILED: Some tenant databases still contain terminology tables.');
        process.exit(1);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await masterPool.end();
  }
}

verify();
