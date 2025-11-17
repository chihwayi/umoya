#!/usr/bin/env ts-node
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from '../services/tenant-service/src/services/database-provisioning.service';

const argv = yargs(hideBin(process.argv))
  .option('keepDb', {
    type: 'boolean',
    default: false,
    describe: 'Keep the temporary smoke-test database for inspection',
  })
  .option('bundles', {
    type: 'array',
    describe: 'Bundles to apply during smoke test (defaults to all bundles)',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  keepDb: boolean;
  bundles?: string[];
};

async function main() {
  const adminDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL;

  if (!adminDbUrl) {
    throw new Error('Set TENANT_SERVICE_DATABASE_URL or DATABASE_URL to the tenant-service database');
  }

  const adminDataSource = new DataSource({
    type: 'postgres',
    url: adminDbUrl,
  });
  await adminDataSource.initialize();

  const provisioningService = new DatabaseProvisioningService(adminDataSource);
  const manifest = provisioningService.getProvisioningBundlesManifest();
  const bundleIds = argv.bundles && argv.bundles.length > 0 ? argv.bundles.map(String) : manifest.map((b) => b.id);

  const tempDbName = `smoke_${Date.now()}_${randomUUID().split('-')[0]}`;
  console.log(`Creating smoke test database: ${tempDbName}`);

  let tempConnectionString: string | null = null;

  try {
    tempConnectionString = await provisioningService.createDatabase(tempDbName);
    console.log('Schema provisioned. Running smoke checks...');

    await provisioningService.applyClinicSchema(tempConnectionString, {
      bundles: bundleIds,
      appliedBy: 'provisioning_smoke_test',
    });

    await runSmokeScenario(tempConnectionString);
    console.log('✅ Smoke test passed – essential workflows succeeded.');
  } finally {
    if (!argv.keepDb) {
      console.log(`Cleaning up temporary database: ${tempDbName}`);
      await adminDataSource.query(`DROP DATABASE IF EXISTS "${tempDbName}"`);
    } else {
      console.log(`Temporary database preserved as ${tempDbName}`);
    }
    await adminDataSource.destroy();
  }
}

async function runSmokeScenario(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const doctor = await client.query(`SELECT id FROM users WHERE role = 'doctor' LIMIT 1`);
    if (doctor.rows.length === 0) {
      throw new Error('No default doctor user found after provisioning.');
    }
    const doctorId = doctor.rows[0].id;

    const patientResult = await client.query(
      `
      INSERT INTO patients (patient_number, first_name, last_name, date_of_birth, gender)
      VALUES ($1, 'Smoke', 'Test', '1990-01-01', 'female')
      RETURNING id
    `,
      [`SMK-${Date.now()}`],
    );
    const patientId = patientResult.rows[0].id;

    const appointmentResult = await client.query(
      `
      INSERT INTO appointments (
        patient_id, doctor_id, appointment_date, appointment_type, status, payment_status
      )
      VALUES ($1, $2, NOW(), 'consultation', 'completed', 'payment_confirmed')
      RETURNING id
    `,
      [patientId, doctorId],
    );
    const appointmentId = appointmentResult.rows[0].id;

    await client.query(
      `
      INSERT INTO vitals (
        patient_id, blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, weight, height, pain_level, recorded_by
      )
      VALUES ($1, '120/80', 72, 36.7, 98, 16, 70, 170, 2, $2)
    `,
      [patientId, doctorId],
    );

    const carePlan = await client.query(`SELECT COUNT(*) AS count FROM vitals WHERE patient_id = $1`, [patientId]);
    if (Number(carePlan.rows[0].count) === 0) {
      throw new Error('Vitals insert failed during smoke test.');
    }

    console.log(
      `Smoke scenario completed – patient ${patientId}, appointment ${appointmentId}, vitals recorded successfully.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Provisioning smoke test failed:', error);
  process.exit(1);
});


