const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function diagnose() {
  const masterClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'umoya',
    password: process.env.DB_PASSWORD || 'umoya_password',
    database: 'umoya_master',
  });

  try {
    await masterClient.connect();
    console.log('Connected to master DB');

    const tenantRes = await masterClient.query("SELECT * FROM tenants WHERE subdomain = 'test'");
    if (tenantRes.rows.length === 0) {
      console.error('Tenant "test" not found');
      return;
    }

    const tenant = tenantRes.rows[0];
    console.log(`Found tenant: ${tenant.name}, DB: "${tenant.databaseName}"`);
    
    await masterClient.end();

    const tenantClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'umoya',
        password: process.env.DB_PASSWORD || 'umoya_password',
        database: tenant.databaseName,
    });

    await tenantClient.connect();
    console.log(`Connected to tenant DB: ${tenant.databaseName}`);

    console.log('\n--- Appointments waiting for payment ---');
    const aptRes = await tenantClient.query(`
        SELECT id, patient_id, appointment_date, status, payment_status, fee_amount, finance_transaction_id 
        FROM appointments 
        WHERE payment_status = 'awaiting_payment'
    `);
    console.table(aptRes.rows);

    console.log('\n--- Financial Transactions (Pending) ---');
    const txRes = await tenantClient.query(`
        SELECT id, patient_id, amount, payment_status, source_reference_id 
        FROM financial_transactions 
        WHERE payment_status = 'pending'
    `);
    console.table(txRes.rows);
    
    console.log('\n--- Mismatches ---');
    for (const apt of aptRes.rows) {
        if (!apt.finance_transaction_id) {
            console.log(`Appointment ${apt.id} has no finance_transaction_id`);
            // Check if there is a transaction for this patient with amount matching fee
            const matchingTx = txRes.rows.find(tx => tx.patient_id === apt.patient_id && parseFloat(tx.amount) === parseFloat(apt.fee_amount));
             if (matchingTx) {
                 console.log(`  -> Found potential orphan transaction: ${matchingTx.id}`);
             } else {
                 console.log(`  -> No matching transaction found`);
             }
        } else {
             const tx = txRes.rows.find(t => t.id === apt.finance_transaction_id);
             if (!tx) {
                 // Check if transaction exists but with different status
                 const txCheck = await tenantClient.query('SELECT * FROM financial_transactions WHERE id = $1', [apt.finance_transaction_id]);
                 if (txCheck.rows.length > 0) {
                     console.log(`Appointment ${apt.id} links to transaction ${apt.finance_transaction_id} but status is '${txCheck.rows[0].payment_status}' (expected 'pending')`);
                 } else {
                     console.log(`Appointment ${apt.id} links to non-existent transaction ${apt.finance_transaction_id}`);
                 }
             } else {
                 console.log(`Appointment ${apt.id} correctly links to pending transaction ${tx.id}`);
             }
        }
    }

    await tenantClient.end();

  } catch (err) {
    console.error('Error:', err);
  }
}

diagnose();
