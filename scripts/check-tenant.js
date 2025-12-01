const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'medicore',
  password: process.env.DB_PASSWORD || 'medicore_password',
  database: 'medicore_master',
};

async function checkOrCreateTenant() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to master database');
    
    // Check if tenant exists
    const checkResult = await client.query(
      `SELECT id, "clinicName", subdomain, "databaseName", status FROM tenants WHERE subdomain = $1`,
      ['bulawayo-general']
    );
    
    if (checkResult.rows.length > 0) {
      const tenant = checkResult.rows[0];
      console.log('✅ Tenant found:');
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Name: ${tenant.clinicName}`);
      console.log(`   Subdomain: ${tenant.subdomain}`);
      console.log(`   Database: ${tenant.databaseName}`);
      console.log(`   Status: ${tenant.status}`);
      
      if (tenant.status !== 'active') {
        console.log(`\n⚠️  Tenant exists but status is "${tenant.status}". Updating to "active"...`);
        await client.query(
          `UPDATE tenants SET status = 'active' WHERE id = $1`,
          [tenant.id]
        );
        console.log('✅ Tenant status updated to "active"');
      }
    } else {
      console.log('❌ Tenant "bulawayo-general" not found. Creating...');
      
      const tenantId = require('crypto').randomUUID();
      const dbName = 'medicore_bulawayo_general';
      
      await client.query(`
        INSERT INTO tenants (
          id, "clinicName", subdomain, "databaseName", status,
          "contactEmail", "subscriptionTier", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        )
      `, [
        tenantId,
        'Bulawayo General Clinic',
        'bulawayo-general',
        dbName,
        'active',
        'admin@bulawayo-general.co.zw',
        'professional'
      ]);
      
      console.log('✅ Tenant created successfully!');
      console.log(`   ID: ${tenantId}`);
      console.log(`   Database: ${dbName}`);
      console.log(`\n⚠️  Note: You may need to create the tenant database "${dbName}" separately.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Could not connect to database. Is PostgreSQL running?');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkOrCreateTenant();



