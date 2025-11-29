#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'string',
    demandOption: true,
    describe: 'Tenant subdomain/slug (e.g., bulawayo-general)',
  })
  .option('patient', {
    type: 'string',
    describe: 'Specific patient UUID to seed (defaults to first patient)',
  })
  .help()
  .alias('help', 'h')
  .parseSync() as { tenant: string; patient?: string };

const MASTER_CONNECTION =
  process.env.TENANT_SERVICE_DATABASE_URL ||
  process.env.ADMIN_DATABASE_URL ||
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USERNAME || 'medicore'}:${
    process.env.DB_PASSWORD || 'medicore_password'
  }@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

function normalizeTenantConnection(conn: string | null, databaseName: string): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';

  if (!conn) {
    return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
  }

  return conn
    .replace('postgres-master', host)
    .replace(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d+)?\//, () => {
      return `postgresql://${username}:${password}@${host}:${port}/`;
    });
}

async function withClient(connectionString: string, fn: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

async function resolveTenant() {
  let tenantConn: string | null = null;
  await withClient(MASTER_CONNECTION, async (client) => {
    const result = await client.query(
      `
        SELECT "databaseName" AS database_name,
               "connectionString" AS connection_string
        FROM tenants
        WHERE subdomain = $1
        LIMIT 1
      `,
      [argv.tenant],
    );
    if (!result.rowCount) {
      throw new Error(`Tenant "${argv.tenant}" not found in master registry.`);
    }
    tenantConn = normalizeTenantConnection(result.rows[0].connection_string, result.rows[0].database_name);
  });
  return tenantConn!;
}

async function seedDiabetesData(connectionString: string) {
  await withClient(connectionString, async (client) => {
    await client.query('BEGIN');
    try {
      const patientId = await resolvePatient(client);
      const providerId = await resolveProvider(client);

      const registryId = await ensureRegistry(client, patientId, providerId);
      await ensureCareBundle(client, registryId, patientId, providerId);
      await ensureGlucoseHistory(client, registryId, patientId, providerId);
      await ensureVitalsHistory(client, patientId, providerId);
      await ensureLabResults(client, patientId, providerId);
      await ensureCgmSummary(client, registryId, patientId);
      await ensureMedication(client, registryId, patientId, providerId);
      await ensureInsulinRegimen(client, registryId, patientId, providerId);
      await ensureComplicationScreening(client, registryId, patientId, providerId);
      await ensureEducationSession(client, registryId, patientId, providerId);
      await ensureAlert(client, registryId, patientId, providerId);
      await ensureDeviceIntegration(client, registryId, patientId);
      await ensurePrescriptionRecord(client, patientId, providerId);

      await client.query('COMMIT');
      console.log('✅ Diabetes seed data applied successfully.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function resolvePatient(client: Client): Promise<string> {
  if (argv.patient) {
    const result = await client.query('SELECT id FROM patients WHERE id = $1 LIMIT 1', [argv.patient]);
    if (!result.rowCount) {
      throw new Error(`Patient ${argv.patient} not found in tenant database.`);
    }
    return argv.patient;
  }
  const result = await client.query('SELECT id FROM patients ORDER BY created_at ASC LIMIT 1');
  if (!result.rowCount) {
    throw new Error('No patients found in tenant database. Seed patients first.');
  }
  return result.rows[0].id;
}

async function resolveProvider(client: Client): Promise<string | null> {
  const result = await client.query(
    `SELECT id FROM users WHERE role IN ('doctor','nurse','technologist') AND is_active = true ORDER BY created_at ASC LIMIT 1`,
  );
  if (result.rowCount) {
    return result.rows[0].id;
  }
  const fallback = await client.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
  return fallback.rowCount ? fallback.rows[0].id : null;
}

async function ensureRegistry(client: Client, patientId: string, providerId: string | null): Promise<string> {
  const existing = await client.query('SELECT id FROM diabetes_registry WHERE patient_id = $1', [patientId]);
  if (existing.rowCount) {
    console.log('ℹ️  Registry already exists for patient.');
    return existing.rows[0].id;
  }
  const insert = await client.query(
    `
      INSERT INTO diabetes_registry (
        patient_id, diabetes_type, diabetes_type_snomed_code, diabetes_type_snomed_term,
        diagnosis_date, age_at_diagnosis, status, family_history,
        primary_care_provider_id, endocrinologist_id, diabetes_educator_id,
        care_plan, notes
      )
      VALUES ($1,'type2','44054006','Type 2 diabetes mellitus',NOW() - INTERVAL '5 years',35,'active',true,$2,$2,$2,
        'WHO-aligned multidisciplinary care plan focusing on glycemic optimization and complication prevention.',
        'Seeded via seed-diabetes-module.ts')
      RETURNING id
    `,
    [patientId, providerId],
  );
  console.log('✅ Created diabetes registry.');
  return insert.rows[0].id;
}

async function ensureCareBundle(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query('SELECT id FROM diabetes_care_bundle WHERE diabetes_registry_id = $1 LIMIT 1', [
    registryId,
  ]);
  if (existing.rowCount) {
    console.log('ℹ️  Care bundle already present.');
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_care_bundle (
        diabetes_registry_id, patient_id, bundle_date,
        hba1c_checked, hba1c_value, hba1c_date,
        blood_pressure_checked, systolic_bp, diastolic_bp, bp_date,
        lipid_profile_checked, lipid_profile_date,
        foot_exam_checked, foot_exam_date, foot_exam_result,
        eye_exam_checked, eye_exam_date, eye_exam_result,
        urine_acr_checked, urine_acr_value, urine_acr_date,
        diabetes_education_documented, education_date,
        medication_review_completed, medication_review_date,
        bundle_completion_percentage, reviewed_by
      )
      VALUES (
        $1,$2, CURRENT_DATE - INTERVAL '30 days',
        true,7.4,CURRENT_DATE - INTERVAL '28 days',
        true,128,78,CURRENT_DATE - INTERVAL '28 days',
        true,CURRENT_DATE - INTERVAL '29 days',
        true,CURRENT_DATE - INTERVAL '25 days','No ulcers, intact sensation.',
        true,CURRENT_DATE - INTERVAL '20 days','Mild NPDR',
        true,38.5,CURRENT_DATE - INTERVAL '27 days',
        true,CURRENT_DATE - INTERVAL '15 days',
        true,CURRENT_DATE - INTERVAL '10 days',
        82,$3
      )
    `,
    [registryId, patientId, providerId],
  );
  console.log('✅ Inserted care bundle snapshot.');
}

async function ensureGlucoseHistory(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query('SELECT count(*)::int AS count FROM glucose_monitoring WHERE diabetes_registry_id = $1', [
    registryId,
  ]);
  if ((existing.rows[0]?.count ?? 0) >= 3) {
    console.log('ℹ️  Glucose history already populated.');
    return;
  }

  const readings = [
    { value: 95, type: 'fasting', offsetHours: 12 },
    { value: 142, type: 'post_meal', offsetHours: 8 },
    { value: 110, type: 'random', offsetHours: 2 },
  ];

  for (const reading of readings) {
    await client.query(
      `
        INSERT INTO glucose_monitoring (
          diabetes_registry_id, patient_id, monitoring_type, device_type, device_id,
          glucose_value, glucose_unit, reading_type, meal_context,
          insulin_dose, insulin_type, carbohydrates_grams, exercise_minutes,
          stress_level, notes, recorded_at, recorded_by
        )
        VALUES (
          $1,$2,'cgm','Dexcom G7','demo-device',
          $3,'mg/dL',$4,'Seed entry',
          NULL,NULL,NULL,20,
          3,'Seeded glucose log',
          NOW() - ($5 || ' hours')::interval,$6
        )
      `,
      [registryId, patientId, reading.value, reading.type, reading.offsetHours, providerId],
    );
  }
  console.log('✅ Inserted glucose readings.');
}

async function ensureCgmSummary(client: Client, registryId: string, patientId: string) {
  const existing = await client.query(
    'SELECT id FROM cgm_summary WHERE diabetes_registry_id = $1 AND summary_date = CURRENT_DATE - INTERVAL \'1 day\'',
    [registryId],
  );
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO cgm_summary (
        diabetes_registry_id, patient_id, summary_date,
        time_in_range_70_180, time_above_range_180, time_below_range_70, time_below_range_54,
        average_glucose, glucose_variability, total_readings, device_type, device_id
      )
      VALUES (
        $1,$2, CURRENT_DATE - INTERVAL '1 day',
        72.5, 20.1, 7.0, 1.2,
        146.4, 18.2, 288, 'Dexcom G7', 'demo-device'
      )
    `,
    [registryId, patientId],
  );
  console.log('✅ Inserted CGM daily summary.');
}

async function ensureMedication(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query('SELECT id FROM diabetes_medications WHERE diabetes_registry_id = $1 LIMIT 1', [
    registryId,
  ]);
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_medications (
        diabetes_registry_id, patient_id, medication_name, medication_type, medication_category,
        dosage, frequency, route, start_date, status, adherence_percentage, prescribed_by, notes
      )
      VALUES (
        $1,$2,'Metformin XR 500 mg','oral','metformin',
        '500 mg','BID','oral', CURRENT_DATE - INTERVAL '4 years','active',92,$3,
        'Continues XR formulation for GI tolerability.'
      )
    `,
    [registryId, patientId, providerId],
  );
  console.log('✅ Added sample diabetes medication.');
}

async function ensureInsulinRegimen(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query('SELECT id FROM insulin_regimens WHERE diabetes_registry_id = $1 LIMIT 1', [
    registryId,
  ]);
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO insulin_regimens (
        diabetes_registry_id, patient_id, regimen_type,
        basal_insulin_type, basal_dose, basal_frequency,
        bolus_insulin_type, bolus_ratio, correction_factor,
        target_glucose, carb_ratio, pump_settings,
        start_date, status, notes, created_by
      )
      VALUES (
        $1,$2,'basal_bolus',
        'Insulin Glargine',22,'once nightly',
        'Insulin Lispro',12,35,
        110,10,'{"profile":"standard"}',
        CURRENT_DATE - INTERVAL '18 months','active','Auto-incremental titration based on CGM trends.',$3
      )
    `,
    [registryId, patientId, providerId],
  );
  console.log('✅ Added insulin regimen.');
}

async function ensureComplicationScreening(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query(
    'SELECT id FROM diabetes_complication_screening WHERE diabetes_registry_id = $1 LIMIT 1',
    [registryId],
  );
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_complication_screening (
        diabetes_registry_id, patient_id, screening_type, screening_date,
        screening_result, screening_result_snomed_code, screening_result_snomed_term,
        severity_grade, findings, treatment_recommended, treatment_plan,
        next_screening_due_date, performed_by, reviewed_by
      )
      VALUES (
        $1,$2,'retinopathy', CURRENT_DATE - INTERVAL '20 days',
        'Mild NPDR without macular edema','312912005','Mild nonproliferative diabetic retinopathy',
        'Mild','Cotton wool spots, microaneurysms',true,'Continue annual OCT + optimize glycemia',
        CURRENT_DATE + INTERVAL '11 months',$3,$3
      )
    `,
    [registryId, patientId, providerId],
  );
  console.log('✅ Recorded complication screening.');
}

async function ensureEducationSession(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query(
    'SELECT id FROM diabetes_education_sessions WHERE diabetes_registry_id = $1 LIMIT 1',
    [registryId],
  );
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_education_sessions (
        diabetes_registry_id, patient_id, session_date, session_type,
        topics_covered, educator_id, patient_attendance, completion_status,
        assessment_score, notes
      )
      VALUES (
        $1,$2, CURRENT_DATE - INTERVAL '5 days','individual',
        ARRAY['carb counting','CGM interpretation','sick day rules'],
        $3,true,'completed',88,'Reviewed sick-day dosing and emergency protocols.'
      )
    `,
    [registryId, patientId, providerId],
  );
  console.log('✅ Logged education session.');
}

async function ensureAlert(client: Client, registryId: string, patientId: string, providerId: string | null) {
  const existing = await client.query(
    `SELECT id FROM diabetes_alerts WHERE diabetes_registry_id = $1 AND resolved = false LIMIT 1`,
    [registryId],
  );
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_alerts (
        diabetes_registry_id, patient_id, alert_type, alert_severity,
        alert_message, related_metric, related_value, related_date
      )
      VALUES (
        $1,$2,'overdue_screening','high',
        'Annual retinal screening overdue by >30 days.',
        'eye_exam',$3, CURRENT_DATE - INTERVAL '45 days'
      )
    `,
    [registryId, patientId, 0],
  );
  console.log('✅ Added overdue screening alert.');
}

async function ensureDeviceIntegration(client: Client, registryId: string, patientId: string) {
  const existing = await client.query(
    'SELECT id FROM diabetes_device_integration WHERE diabetes_registry_id = $1 LIMIT 1',
    [registryId],
  );
  if (existing.rowCount) {
    return;
  }
  await client.query(
    `
      INSERT INTO diabetes_device_integration (
        diabetes_registry_id, patient_id, device_type, device_brand, device_model,
        device_serial_number, device_id, integration_type, integration_status,
        last_sync_at, sync_frequency, settings
      )
      VALUES (
        $1,$2,'cgm','Dexcom','G7','SN-DEMO-001','demo-device','api','active',
        NOW() - INTERVAL '2 hours','15min','{"dataPartner":"sandbox"}'
      )
    `,
    [registryId, patientId],
  );
  console.log('✅ Registered CGM integration.');
}

async function ensureVitalsHistory(client: Client, patientId: string, providerId: string | null) {
  const existing = await client.query(
    `SELECT COUNT(*)::int AS count FROM vitals WHERE patient_id = $1 AND blood_glucose IS NOT NULL`,
    [patientId],
  );
  if ((existing.rows[0]?.count ?? 0) >= 3) {
    return;
  }
  const recordedBy = providerId ?? (await resolveProvider(client));
  if (!recordedBy) {
    console.warn('⚠️  Unable to resolve clinician for vitals seeding. Skipping vitals integration.');
    return;
  }
  const snapshots = [
    { bg: 198, bp: '138/86', hr: 88, temp: 36.6, offsetHours: 48 },
    { bg: 165, bp: '132/82', hr: 84, temp: 36.7, offsetHours: 30 },
    { bg: 212, bp: '140/90', hr: 92, temp: 36.8, offsetHours: 12 },
    { bg: 74, bp: '126/78', hr: 80, temp: 36.5, offsetHours: 4 },
  ];
  for (const snapshot of snapshots) {
    await client.query(
      `
        INSERT INTO vitals (
          patient_id, blood_pressure, heart_rate, temperature,
          oxygen_saturation, respiratory_rate, weight, height,
          bmi, pain_level, blood_glucose, notes, recorded_at, recorded_by, created_at, updated_at
        )
        VALUES (
          $1,$2,$3,$4,
          98,18,70.5,1.72,
          23.8,2,$5,'Seeded vitals integration',
          NOW() - ($6 || ' hours')::interval,$7,NOW(),NOW()
        )
      `,
      [patientId, snapshot.bp, snapshot.hr, snapshot.temp, snapshot.bg, snapshot.offsetHours, recordedBy],
    );
  }
  console.log('✅ Added vitals history with blood glucose readings.');
}

async function ensureLabResults(client: Client, patientId: string, providerId: string | null) {
  const existing = await client.query(
    `SELECT COUNT(*)::int AS count FROM lab_results WHERE patient_id = $1 AND status = 'completed'`,
    [patientId],
  );
  if ((existing.rows[0]?.count ?? 0) >= 3) {
    return;
  }
  const orderedBy = providerId ?? (await resolveProvider(client));
  if (!orderedBy) {
    console.warn('⚠️  Unable to resolve clinician for lab seeding. Skipping lab integration.');
    return;
  }
  const labs = [
    {
      testName: 'HbA1c',
      testType: 'chemistry',
      value: '8.4',
      unit: '%',
      reference: '4.0 - 5.6',
      completedOffsetDays: 10,
    },
    {
      testName: 'LDL Cholesterol',
      testType: 'lipid panel',
      value: '138',
      unit: 'mg/dL',
      reference: '< 100',
      completedOffsetDays: 12,
    },
    {
      testName: 'Urine Albumin/Creatinine Ratio',
      testType: 'urine',
      value: '45',
      unit: 'mg/g',
      reference: '< 30',
      completedOffsetDays: 9,
    },
  ];
  for (const lab of labs) {
    await client.query(
      `
        INSERT INTO lab_results (
          patient_id, test_name, test_type, result_value, result_unit,
          reference_range, status, notes, ordered_by, reviewed_by,
          ordered_at, completed_at, created_at, updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,'completed','Seeded diabetes integration lab',$7,$7,
          NOW() - ($8 || ' days')::interval,
          NOW() - ($8 || ' days')::interval,
          NOW(),NOW()
        )
      `,
      [patientId, lab.testName, lab.testType, lab.value, lab.unit, lab.reference, orderedBy, lab.completedOffsetDays],
    );
  }
  console.log('✅ Inserted representative lab results (HbA1c, lipid, urine ACR).');
}

async function ensurePrescriptionRecord(client: Client, patientId: string, providerId: string | null) {
  const existing = await client.query(
    `SELECT COUNT(*)::int AS count FROM prescriptions WHERE patient_id = $1 AND is_active = true`,
    [patientId],
  );
  if ((existing.rows[0]?.count ?? 0) >= 1) {
    return;
  }
  const doctorId = providerId ?? (await resolveProvider(client));
  if (!doctorId) {
    console.warn('⚠️  Unable to resolve clinician for prescription seeding.');
    return;
  }
  await client.query(
    `
      INSERT INTO prescriptions (
        patient_id, doctor_id, medication_name, medication_name_snomed_code,
        medication_name_snomed_term, dosage, frequency, duration,
        instructions, quantity, refills, is_active, prescribed_at, created_at, updated_at
      )
      VALUES (
        $1,$2,'Semaglutide 0.5mg pen','457747005',
        'Semaglutide (medicinal product)','0.5 mg','weekly','90 days',
        'Administer once weekly via subcutaneous injection.',4,1,true,
        NOW() - INTERVAL '14 days',NOW(),NOW()
      )
    `,
    [patientId, doctorId],
  );
  console.log('✅ Added metabolic prescription for integration testing.');
}

async function main() {
  const tenantConnection = await resolveTenant();
  console.log(`Seeding diabetes module data for tenant "${argv.tenant}"...`);
  await seedDiabetesData(tenantConnection);
}

main().catch((error) => {
  console.error('❌ Failed to seed diabetes module:', error);
  process.exit(1);
});


