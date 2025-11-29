#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'string',
    demandOption: true,
    describe: 'Tenant subdomain/slug to upgrade (e.g., bulawayo-general)',
  })
  .help()
  .alias('help', 'h')
  .parseSync() as { tenant: string };

const sprint5Statements: string[] = [
  `CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    appointment_type VARCHAR(100),
    preferred_date DATE,
    preferred_time_start TIME,
    preferred_time_end TIME,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    reason TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'scheduled', 'cancelled', 'expired')),
    notified_at TIMESTAMP WITH TIME ZONE,
    scheduled_appointment_id UUID REFERENCES appointments(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_patient_id ON appointment_waitlist(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_doctor_id ON appointment_waitlist(doctor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_status ON appointment_waitlist(status)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_priority ON appointment_waitlist(priority)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_preferred_date ON appointment_waitlist(preferred_date)`,

  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoice_number_unique ON billing(invoice_number) WHERE invoice_number IS NOT NULL`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS invoice_date DATE`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS due_date DATE`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2)`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS template_id UUID`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoice_number ON billing(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoice_date ON billing(invoice_date)`,

  `CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_active ON invoice_templates(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_default ON invoice_templates(is_default)`,

  `CREATE TABLE IF NOT EXISTS lab_order_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('CBC', 'BMP', 'LFT', 'Lipid', 'Thyroid', 'Hormone', 'Other')),
    tests JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_order_templates_category ON lab_order_templates(category)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_order_templates_is_active ON lab_order_templates(is_active)`,

  `CREATE TABLE IF NOT EXISTS imaging_order_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('X-Ray', 'CT', 'MRI', 'Ultrasound', 'Echocardiogram', 'Other')),
    imaging_type VARCHAR(100) NOT NULL,
    body_part VARCHAR(100),
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_imaging_order_templates_category ON imaging_order_templates(category)`,
  `CREATE INDEX IF NOT EXISTS idx_imaging_order_templates_is_active ON imaging_order_templates(is_active)`,

  `DROP TRIGGER IF EXISTS update_appointment_waitlist_updated_at ON appointment_waitlist`,
  `CREATE TRIGGER update_appointment_waitlist_updated_at
     BEFORE UPDATE ON appointment_waitlist
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON invoice_templates`,
  `CREATE TRIGGER update_invoice_templates_updated_at
     BEFORE UPDATE ON invoice_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_lab_order_templates_updated_at ON lab_order_templates`,
  `CREATE TRIGGER update_lab_order_templates_updated_at
     BEFORE UPDATE ON lab_order_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_imaging_order_templates_updated_at ON imaging_order_templates`,
  `CREATE TRIGGER update_imaging_order_templates_updated_at
     BEFORE UPDATE ON imaging_order_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
];

function resolveMasterConnection(): string {
  return (
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`
  );
}

function normalizeTenantConnection(connectionString: string | null, databaseName: string): string {
  if (connectionString) {
    const host = process.env.DB_HOST || 'localhost';
    const username = process.env.DB_USERNAME || 'medicore';
    const password = process.env.DB_PASSWORD || 'medicore_password';
    return connectionString
      .replace(/postgres-master/g, host)
      .replace(/postgresql:\/\/[^:]+:[^@]+@[^:]+:(\d+)\//, (_match, port: string) => {
        return `postgresql://${username}:${password}@${host}:${port}/`;
      });
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';
  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
}

async function main() {
  const masterConnection = resolveMasterConnection();
  const masterClient = new Client({ connectionString: masterConnection });
  await masterClient.connect();

  try {
    const tenantResult = await masterClient.query(
      `
        SELECT id,
               "clinicName"  AS clinic_name,
               subdomain,
               "databaseName" AS database_name,
               "connectionString" AS connection_string
        FROM tenants
        WHERE subdomain = $1
        LIMIT 1
      `,
      [argv.tenant],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant with subdomain "${argv.tenant}" was not found.`);
    }

    const tenant = tenantResult.rows[0];
    const tenantConn = normalizeTenantConnection(tenant.connection_string, tenant.database_name);

    console.log(`Applying Sprint 5 schema to tenant ${tenant.clinic_name} (${tenant.subdomain})...`);
    const tenantClient = new Client({ connectionString: tenantConn });
    await tenantClient.connect();

    try {
      for (let i = 0; i < sprint5Statements.length; i += 1) {
        const statement = sprint5Statements[i];
        try {
          await tenantClient.query(statement);
        } catch (error) {
          console.error(`Statement ${i + 1} failed:\n${statement}`);
          throw error;
        }
      }

      await tenantClient.query(
        `
          INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
          VALUES ('sprint5_features', '2025.03.02', NOW(), 'apply-sprint5-schema-script')
          ON CONFLICT (bundle_id) DO UPDATE
          SET version = EXCLUDED.version,
              applied_at = NOW(),
              applied_by = EXCLUDED.applied_by
        `,
      );

      console.log('✅ Sprint 5 schema applied successfully.');
    } finally {
      await tenantClient.end();
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply Sprint 5 schema:', error);
  process.exit(1);
});




import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'string',
    demandOption: true,
    describe: 'Tenant subdomain/slug to upgrade (e.g., bulawayo-general)',
  })
  .help()
  .alias('help', 'h')
  .parseSync() as { tenant: string };

const sprint5Statements: string[] = [
  `CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    appointment_type VARCHAR(100),
    preferred_date DATE,
    preferred_time_start TIME,
    preferred_time_end TIME,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    reason TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'scheduled', 'cancelled', 'expired')),
    notified_at TIMESTAMP WITH TIME ZONE,
    scheduled_appointment_id UUID REFERENCES appointments(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_patient_id ON appointment_waitlist(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_doctor_id ON appointment_waitlist(doctor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_status ON appointment_waitlist(status)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_priority ON appointment_waitlist(priority)`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_waitlist_preferred_date ON appointment_waitlist(preferred_date)`,

  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoice_number_unique ON billing(invoice_number) WHERE invoice_number IS NOT NULL`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS invoice_date DATE`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS due_date DATE`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2)`,
  `ALTER TABLE billing ADD COLUMN IF NOT EXISTS template_id UUID`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoice_number ON billing(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoice_date ON billing(invoice_date)`,

  `CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_active ON invoice_templates(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_default ON invoice_templates(is_default)`,

  `CREATE TABLE IF NOT EXISTS lab_order_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('CBC', 'BMP', 'LFT', 'Lipid', 'Thyroid', 'Hormone', 'Other')),
    tests JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_order_templates_category ON lab_order_templates(category)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_order_templates_is_active ON lab_order_templates(is_active)`,

  `CREATE TABLE IF NOT EXISTS imaging_order_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('X-Ray', 'CT', 'MRI', 'Ultrasound', 'Echocardiogram', 'Other')),
    imaging_type VARCHAR(100) NOT NULL,
    body_part VARCHAR(100),
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_imaging_order_templates_category ON imaging_order_templates(category)`,
  `CREATE INDEX IF NOT EXISTS idx_imaging_order_templates_is_active ON imaging_order_templates(is_active)`,

  `DROP TRIGGER IF EXISTS update_appointment_waitlist_updated_at ON appointment_waitlist`,
  `CREATE TRIGGER update_appointment_waitlist_updated_at
     BEFORE UPDATE ON appointment_waitlist
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON invoice_templates`,
  `CREATE TRIGGER update_invoice_templates_updated_at
     BEFORE UPDATE ON invoice_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_lab_order_templates_updated_at ON lab_order_templates`,
  `CREATE TRIGGER update_lab_order_templates_updated_at
     BEFORE UPDATE ON lab_order_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  `DROP TRIGGER IF EXISTS update_imaging_order_templates_updated_at ON imaging_order_templates`,
  `CREATE TRIGGER update_imaging_order_templates_updated_at
     BEFORE UPDATE ON imaging_order_templates
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
];

function resolveMasterConnection(): string {
  return (
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`
  );
}

function normalizeTenantConnection(connectionString: string | null, databaseName: string): string {
  if (connectionString) {
    const host = process.env.DB_HOST || 'localhost';
    const username = process.env.DB_USERNAME || 'medicore';
    const password = process.env.DB_PASSWORD || 'medicore_password';
    return connectionString
      .replace(/postgres-master/g, host)
      .replace(/postgresql:\/\/[^:]+:[^@]+@[^:]+:(\d+)\//, (_match, port: string) => {
        return `postgresql://${username}:${password}@${host}:${port}/`;
      });
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';
  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
}

async function main() {
  const masterConnection = resolveMasterConnection();
  const masterClient = new Client({ connectionString: masterConnection });
  await masterClient.connect();

  try {
    const tenantResult = await masterClient.query(
      `
        SELECT id,
               "clinicName"  AS clinic_name,
               subdomain,
               "databaseName" AS database_name,
               "connectionString" AS connection_string
        FROM tenants
        WHERE subdomain = $1
        LIMIT 1
      `,
      [argv.tenant],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant with subdomain "${argv.tenant}" was not found.`);
    }

    const tenant = tenantResult.rows[0];
    const tenantConn = normalizeTenantConnection(tenant.connection_string, tenant.database_name);

    console.log(`Applying Sprint 5 schema to tenant ${tenant.clinic_name} (${tenant.subdomain})...`);
    const tenantClient = new Client({ connectionString: tenantConn });
    await tenantClient.connect();

    try {
      for (let i = 0; i < sprint5Statements.length; i += 1) {
        const statement = sprint5Statements[i];
        try {
          await tenantClient.query(statement);
        } catch (error) {
          console.error(`Statement ${i + 1} failed:\n${statement}`);
          throw error;
        }
      }

      await tenantClient.query(
        `
          INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
          VALUES ('sprint5_features', '2025.03.02', NOW(), 'apply-sprint5-schema-script')
          ON CONFLICT (bundle_id) DO UPDATE
          SET version = EXCLUDED.version,
              applied_at = NOW(),
              applied_by = EXCLUDED.applied_by
        `,
      );

      console.log('✅ Sprint 5 schema applied successfully.');
    } finally {
      await tenantClient.end();
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply Sprint 5 schema:', error);
  process.exit(1);
});





























