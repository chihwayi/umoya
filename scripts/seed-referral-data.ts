#!/usr/bin/env node
/**
 * Seed Referral Templates and Facilities
 * Populates default referral templates and facility directory
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    console.log('\n🌱 Seeding Referral Data for bulawayo-general\n');

    // Get bulawayo-general tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = 'bulawayo-general'
    `);

    if (tenantsResult.rows.length === 0) {
      throw new Error('Tenant bulawayo-general not found');
    }

    const tenant = tenantsResult.rows[0];
    console.log(`✅ Found tenant: ${tenant.clinic_name}\n`);

    // Connect to tenant database
    const connectionString = tenant.connection_string.replace('postgres-master', 'localhost');
    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    // ==================== SEED REFERRAL TEMPLATES ====================
    console.log('📋 Seeding referral templates...\n');

    const templates = [
      {
        name: 'Cardiology Referral',
        referral_type: 'cardiology',
        specialty: 'Cardiology',
        template_data: {
          reason: 'Cardiac evaluation required',
          requestedServices: 'ECG, Echocardiogram, Cardiac stress test',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Orthopedic Referral',
        referral_type: 'specialist',
        specialty: 'Orthopedics',
        template_data: {
          reason: 'Musculoskeletal evaluation',
          requestedServices: 'X-ray, Physical examination, Treatment plan',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Mental Health Referral',
        referral_type: 'mental_health',
        specialty: 'Psychiatry',
        template_data: {
          reason: 'Mental health assessment and treatment',
          requestedServices: 'Psychiatric evaluation, Counseling',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Oncology Referral',
        referral_type: 'oncology',
        specialty: 'Oncology',
        template_data: {
          reason: 'Cancer screening/treatment consultation',
          requestedServices: 'Oncology consultation, Treatment planning',
          priority: 'high',
          urgency: 'urgent',
        },
        is_default: true,
      },
      {
        name: 'Ophthalmology Referral',
        referral_type: 'ophthalmology',
        specialty: 'Ophthalmology',
        template_data: {
          reason: 'Eye examination and treatment',
          requestedServices: 'Comprehensive eye exam, Vision testing',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Dental Referral',
        referral_type: 'dental',
        specialty: 'Dentistry',
        template_data: {
          reason: 'Dental evaluation and treatment',
          requestedServices: 'Dental examination, X-rays',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Laboratory Testing',
        referral_type: 'laboratory',
        specialty: 'Laboratory Medicine',
        template_data: {
          reason: 'Laboratory tests required',
          requestedServices: 'Blood work, Urinalysis',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Imaging Referral',
        referral_type: 'imaging',
        specialty: 'Radiology',
        template_data: {
          reason: 'Diagnostic imaging required',
          requestedServices: 'X-ray, CT scan, MRI, Ultrasound',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Physical Therapy Referral',
        referral_type: 'therapy',
        specialty: 'Physical Therapy',
        template_data: {
          reason: 'Physical rehabilitation required',
          requestedServices: 'Physical therapy evaluation, Treatment sessions',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Surgical Consultation',
        referral_type: 'surgery',
        specialty: 'General Surgery',
        template_data: {
          reason: 'Surgical evaluation required',
          requestedServices: 'Surgical consultation, Pre-operative assessment',
          priority: 'high',
          urgency: 'urgent',
        },
        is_default: true,
      },
    ];

    for (const template of templates) {
      await tenantClient.query(
        `INSERT INTO referral_templates (name, referral_type, specialty, template_data, is_default, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          template.name,
          template.referral_type,
          template.specialty,
          JSON.stringify(template.template_data),
          template.is_default,
        ],
      );
      console.log(`  ✓ ${template.name}`);
    }

    console.log(`\n✅ Seeded ${templates.length} referral templates\n`);

    // ==================== SEED REFERRAL FACILITIES ====================
    console.log('🏥 Seeding referral facilities...\n');

    const facilities = [
      {
        facility_name: 'Bulawayo Cardiac Center',
        facility_type: 'specialist_practice',
        specialties: ['Cardiology', 'Cardiac Surgery'],
        address: '123 Heart Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 12345',
        email: 'referrals@bulawayocardiac.co.zw',
        contact_person: 'Dr. Moyo',
        referral_process: 'Email or fax referral form. Response within 48 hours.',
        required_documents: ['Referral letter', 'Recent ECG', 'Medical history'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'Mpilo Central Hospital',
        facility_type: 'hospital',
        specialties: ['General Surgery', 'Orthopedics', 'Oncology', 'Emergency Medicine'],
        address: 'Vera Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 72111',
        email: 'referrals@mpilo.co.zw',
        contact_person: 'Referrals Department',
        referral_process: 'Submit referral through hospital portal or fax.',
        required_documents: ['Referral letter', 'Lab results', 'Imaging reports'],
        average_wait_time_days: 21,
      },
      {
        facility_name: 'Bulawayo Eye Institute',
        facility_type: 'specialist_practice',
        specialties: ['Ophthalmology', 'Optometry'],
        address: '45 Vision Avenue, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 23456',
        email: 'appointments@bulawayoeye.co.zw',
        contact_person: 'Dr. Ncube',
        referral_process: 'Email referral. Appointments scheduled within 1 week.',
        required_documents: ['Referral letter', 'Vision test results'],
        average_wait_time_days: 7,
      },
      {
        facility_name: 'Bulawayo Diagnostic Laboratory',
        facility_type: 'laboratory',
        specialties: ['Laboratory Medicine', 'Pathology'],
        address: '78 Lab Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 34567',
        email: 'samples@bulawayolab.co.zw',
        contact_person: 'Lab Manager',
        referral_process: 'Walk-in or scheduled appointments. Results in 24-48 hours.',
        required_documents: ['Test request form', 'Patient ID'],
        average_wait_time_days: 2,
      },
      {
        facility_name: 'Bulawayo Imaging Center',
        facility_type: 'imaging_center',
        specialties: ['Radiology', 'Medical Imaging'],
        address: '90 Scan Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 45678',
        email: 'bookings@bulawayoimaging.co.zw',
        contact_person: 'Radiology Department',
        referral_process: 'Book online or by phone. Urgent cases prioritized.',
        required_documents: ['Referral letter', 'Clinical indication'],
        average_wait_time_days: 5,
      },
      {
        facility_name: 'Bulawayo Mental Health Clinic',
        facility_type: 'clinic',
        specialties: ['Psychiatry', 'Clinical Psychology', 'Counseling'],
        address: '12 Wellness Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 56789',
        email: 'intake@bulawayomentalhealth.co.zw',
        contact_person: 'Dr. Sibanda',
        referral_process: 'Email or phone referral. Initial assessment within 1 week.',
        required_documents: ['Referral letter', 'Medical history', 'Current medications'],
        average_wait_time_days: 7,
      },
      {
        facility_name: 'Bulawayo Physiotherapy Center',
        facility_type: 'therapy_center',
        specialties: ['Physical Therapy', 'Occupational Therapy', 'Sports Medicine'],
        address: '34 Recovery Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 67890',
        email: 'bookings@bulawayophysio.co.zw',
        contact_person: 'Therapy Coordinator',
        referral_process: 'Email referral. First session within 5 days.',
        required_documents: ['Referral letter', 'Diagnosis', 'Treatment goals'],
        average_wait_time_days: 5,
      },
      {
        facility_name: 'Bulawayo Dental Specialists',
        facility_type: 'specialist_practice',
        specialties: ['Dentistry', 'Oral Surgery', 'Orthodontics'],
        address: '56 Smile Avenue, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 78901',
        email: 'referrals@bulawayodental.co.zw',
        contact_person: 'Dr. Dube',
        referral_process: 'Email or fax referral. Appointments within 2 weeks.',
        required_documents: ['Referral letter', 'Dental X-rays if available'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'United Bulawayo Hospitals',
        facility_type: 'hospital',
        specialties: ['General Medicine', 'Surgery', 'Pediatrics', 'Obstetrics'],
        address: 'Hillside Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 68000',
        email: 'referrals@ubh.co.zw',
        contact_person: 'Referrals Office',
        referral_process: 'Submit through hospital system or email.',
        required_documents: ['Referral letter', 'Medical records', 'Insurance details'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'Bulawayo Orthopedic Clinic',
        facility_type: 'specialist_practice',
        specialties: ['Orthopedics', 'Sports Medicine', 'Trauma Surgery'],
        address: '23 Bone Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 89012',
        email: 'referrals@bulawayoortho.co.zw',
        contact_person: 'Dr. Ndlovu',
        referral_process: 'Email referral with imaging. Urgent cases seen within 3 days.',
        required_documents: ['Referral letter', 'X-rays', 'MRI if available'],
        average_wait_time_days: 10,
      },
    ];

    for (const facility of facilities) {
      await tenantClient.query(
        `INSERT INTO referral_facilities (
          facility_name, facility_type, specialties, address, city, phone, email,
          contact_person, referral_process, required_documents, average_wait_time_days,
          accepts_insurance, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, true, NOW(), NOW())
        ON CONFLICT DO NOTHING`,
        [
          facility.facility_name,
          facility.facility_type,
          facility.specialties,
          facility.address,
          facility.city,
          facility.phone,
          facility.email,
          facility.contact_person,
          facility.referral_process,
          facility.required_documents,
          facility.average_wait_time_days,
        ],
      );
      console.log(`  ✓ ${facility.facility_name}`);
    }

    console.log(`\n✅ Seeded ${facilities.length} referral facilities\n`);

    console.log('🎉 Seeding completed successfully!\n');

    await tenantClient.end();
    await masterClient.end();
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    await masterClient.end();
    process.exit(1);
  }
}

main();


/**
 * Seed Referral Templates and Facilities
 * Populates default referral templates and facility directory
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    console.log('\n🌱 Seeding Referral Data for bulawayo-general\n');

    // Get bulawayo-general tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = 'bulawayo-general'
    `);

    if (tenantsResult.rows.length === 0) {
      throw new Error('Tenant bulawayo-general not found');
    }

    const tenant = tenantsResult.rows[0];
    console.log(`✅ Found tenant: ${tenant.clinic_name}\n`);

    // Connect to tenant database
    const connectionString = tenant.connection_string.replace('postgres-master', 'localhost');
    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    // ==================== SEED REFERRAL TEMPLATES ====================
    console.log('📋 Seeding referral templates...\n');

    const templates = [
      {
        name: 'Cardiology Referral',
        referral_type: 'cardiology',
        specialty: 'Cardiology',
        template_data: {
          reason: 'Cardiac evaluation required',
          requestedServices: 'ECG, Echocardiogram, Cardiac stress test',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Orthopedic Referral',
        referral_type: 'specialist',
        specialty: 'Orthopedics',
        template_data: {
          reason: 'Musculoskeletal evaluation',
          requestedServices: 'X-ray, Physical examination, Treatment plan',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Mental Health Referral',
        referral_type: 'mental_health',
        specialty: 'Psychiatry',
        template_data: {
          reason: 'Mental health assessment and treatment',
          requestedServices: 'Psychiatric evaluation, Counseling',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Oncology Referral',
        referral_type: 'oncology',
        specialty: 'Oncology',
        template_data: {
          reason: 'Cancer screening/treatment consultation',
          requestedServices: 'Oncology consultation, Treatment planning',
          priority: 'high',
          urgency: 'urgent',
        },
        is_default: true,
      },
      {
        name: 'Ophthalmology Referral',
        referral_type: 'ophthalmology',
        specialty: 'Ophthalmology',
        template_data: {
          reason: 'Eye examination and treatment',
          requestedServices: 'Comprehensive eye exam, Vision testing',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Dental Referral',
        referral_type: 'dental',
        specialty: 'Dentistry',
        template_data: {
          reason: 'Dental evaluation and treatment',
          requestedServices: 'Dental examination, X-rays',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Laboratory Testing',
        referral_type: 'laboratory',
        specialty: 'Laboratory Medicine',
        template_data: {
          reason: 'Laboratory tests required',
          requestedServices: 'Blood work, Urinalysis',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Imaging Referral',
        referral_type: 'imaging',
        specialty: 'Radiology',
        template_data: {
          reason: 'Diagnostic imaging required',
          requestedServices: 'X-ray, CT scan, MRI, Ultrasound',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Physical Therapy Referral',
        referral_type: 'therapy',
        specialty: 'Physical Therapy',
        template_data: {
          reason: 'Physical rehabilitation required',
          requestedServices: 'Physical therapy evaluation, Treatment sessions',
          priority: 'normal',
          urgency: 'routine',
        },
        is_default: true,
      },
      {
        name: 'Surgical Consultation',
        referral_type: 'surgery',
        specialty: 'General Surgery',
        template_data: {
          reason: 'Surgical evaluation required',
          requestedServices: 'Surgical consultation, Pre-operative assessment',
          priority: 'high',
          urgency: 'urgent',
        },
        is_default: true,
      },
    ];

    for (const template of templates) {
      await tenantClient.query(
        `INSERT INTO referral_templates (name, referral_type, specialty, template_data, is_default, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          template.name,
          template.referral_type,
          template.specialty,
          JSON.stringify(template.template_data),
          template.is_default,
        ],
      );
      console.log(`  ✓ ${template.name}`);
    }

    console.log(`\n✅ Seeded ${templates.length} referral templates\n`);

    // ==================== SEED REFERRAL FACILITIES ====================
    console.log('🏥 Seeding referral facilities...\n');

    const facilities = [
      {
        facility_name: 'Bulawayo Cardiac Center',
        facility_type: 'specialist_practice',
        specialties: ['Cardiology', 'Cardiac Surgery'],
        address: '123 Heart Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 12345',
        email: 'referrals@bulawayocardiac.co.zw',
        contact_person: 'Dr. Moyo',
        referral_process: 'Email or fax referral form. Response within 48 hours.',
        required_documents: ['Referral letter', 'Recent ECG', 'Medical history'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'Mpilo Central Hospital',
        facility_type: 'hospital',
        specialties: ['General Surgery', 'Orthopedics', 'Oncology', 'Emergency Medicine'],
        address: 'Vera Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 72111',
        email: 'referrals@mpilo.co.zw',
        contact_person: 'Referrals Department',
        referral_process: 'Submit referral through hospital portal or fax.',
        required_documents: ['Referral letter', 'Lab results', 'Imaging reports'],
        average_wait_time_days: 21,
      },
      {
        facility_name: 'Bulawayo Eye Institute',
        facility_type: 'specialist_practice',
        specialties: ['Ophthalmology', 'Optometry'],
        address: '45 Vision Avenue, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 23456',
        email: 'appointments@bulawayoeye.co.zw',
        contact_person: 'Dr. Ncube',
        referral_process: 'Email referral. Appointments scheduled within 1 week.',
        required_documents: ['Referral letter', 'Vision test results'],
        average_wait_time_days: 7,
      },
      {
        facility_name: 'Bulawayo Diagnostic Laboratory',
        facility_type: 'laboratory',
        specialties: ['Laboratory Medicine', 'Pathology'],
        address: '78 Lab Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 34567',
        email: 'samples@bulawayolab.co.zw',
        contact_person: 'Lab Manager',
        referral_process: 'Walk-in or scheduled appointments. Results in 24-48 hours.',
        required_documents: ['Test request form', 'Patient ID'],
        average_wait_time_days: 2,
      },
      {
        facility_name: 'Bulawayo Imaging Center',
        facility_type: 'imaging_center',
        specialties: ['Radiology', 'Medical Imaging'],
        address: '90 Scan Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 45678',
        email: 'bookings@bulawayoimaging.co.zw',
        contact_person: 'Radiology Department',
        referral_process: 'Book online or by phone. Urgent cases prioritized.',
        required_documents: ['Referral letter', 'Clinical indication'],
        average_wait_time_days: 5,
      },
      {
        facility_name: 'Bulawayo Mental Health Clinic',
        facility_type: 'clinic',
        specialties: ['Psychiatry', 'Clinical Psychology', 'Counseling'],
        address: '12 Wellness Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 56789',
        email: 'intake@bulawayomentalhealth.co.zw',
        contact_person: 'Dr. Sibanda',
        referral_process: 'Email or phone referral. Initial assessment within 1 week.',
        required_documents: ['Referral letter', 'Medical history', 'Current medications'],
        average_wait_time_days: 7,
      },
      {
        facility_name: 'Bulawayo Physiotherapy Center',
        facility_type: 'therapy_center',
        specialties: ['Physical Therapy', 'Occupational Therapy', 'Sports Medicine'],
        address: '34 Recovery Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 67890',
        email: 'bookings@bulawayophysio.co.zw',
        contact_person: 'Therapy Coordinator',
        referral_process: 'Email referral. First session within 5 days.',
        required_documents: ['Referral letter', 'Diagnosis', 'Treatment goals'],
        average_wait_time_days: 5,
      },
      {
        facility_name: 'Bulawayo Dental Specialists',
        facility_type: 'specialist_practice',
        specialties: ['Dentistry', 'Oral Surgery', 'Orthodontics'],
        address: '56 Smile Avenue, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 78901',
        email: 'referrals@bulawayodental.co.zw',
        contact_person: 'Dr. Dube',
        referral_process: 'Email or fax referral. Appointments within 2 weeks.',
        required_documents: ['Referral letter', 'Dental X-rays if available'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'United Bulawayo Hospitals',
        facility_type: 'hospital',
        specialties: ['General Medicine', 'Surgery', 'Pediatrics', 'Obstetrics'],
        address: 'Hillside Road, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 68000',
        email: 'referrals@ubh.co.zw',
        contact_person: 'Referrals Office',
        referral_process: 'Submit through hospital system or email.',
        required_documents: ['Referral letter', 'Medical records', 'Insurance details'],
        average_wait_time_days: 14,
      },
      {
        facility_name: 'Bulawayo Orthopedic Clinic',
        facility_type: 'specialist_practice',
        specialties: ['Orthopedics', 'Sports Medicine', 'Trauma Surgery'],
        address: '23 Bone Street, Bulawayo',
        city: 'Bulawayo',
        phone: '+263 9 89012',
        email: 'referrals@bulawayoortho.co.zw',
        contact_person: 'Dr. Ndlovu',
        referral_process: 'Email referral with imaging. Urgent cases seen within 3 days.',
        required_documents: ['Referral letter', 'X-rays', 'MRI if available'],
        average_wait_time_days: 10,
      },
    ];

    for (const facility of facilities) {
      await tenantClient.query(
        `INSERT INTO referral_facilities (
          facility_name, facility_type, specialties, address, city, phone, email,
          contact_person, referral_process, required_documents, average_wait_time_days,
          accepts_insurance, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, true, NOW(), NOW())
        ON CONFLICT DO NOTHING`,
        [
          facility.facility_name,
          facility.facility_type,
          facility.specialties,
          facility.address,
          facility.city,
          facility.phone,
          facility.email,
          facility.contact_person,
          facility.referral_process,
          facility.required_documents,
          facility.average_wait_time_days,
        ],
      );
      console.log(`  ✓ ${facility.facility_name}`);
    }

    console.log(`\n✅ Seeded ${facilities.length} referral facilities\n`);

    console.log('🎉 Seeding completed successfully!\n');

    await tenantClient.end();
    await masterClient.end();
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    await masterClient.end();
    process.exit(1);
  }
}

main();


