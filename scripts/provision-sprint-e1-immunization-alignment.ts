import { Client } from 'pg';

const BUNDLE_ID = 'sprint_e1_immunization_alignment';
const BUNDLE_VERSION = '2026.03.08';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function buildTenantConnection(databaseName: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  return {
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseName,
  };
}

function getStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS immunizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      immunization_number VARCHAR(30),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      vaccine_code VARCHAR(20) NOT NULL,
      vaccine_name VARCHAR(255) NOT NULL,
      cvx_code VARCHAR(10),
      dose_number INTEGER,
      dose_quantity DECIMAL(5,2),
      dose_unit VARCHAR(20) DEFAULT 'mL',
      route VARCHAR(50),
      site VARCHAR(100),
      lot_number VARCHAR(50),
      manufacturer VARCHAR(100),
      expiration_date DATE,
      administration_date TIMESTAMP WITH TIME ZONE NOT NULL,
      administered_by UUID REFERENCES users(id),
      vis_document VARCHAR(255),
      vis_date DATE,
      vis_presented BOOLEAN DEFAULT false,
      status VARCHAR(50) DEFAULT 'completed',
      refusal_reason TEXT,
      notes TEXT,
      registry_status VARCHAR(50) DEFAULT 'pending',
      snomed_vaccine_code VARCHAR(20),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_immunizations_vaccine ON immunizations(vaccine_code)`,
    `CREATE INDEX IF NOT EXISTS idx_immunizations_date ON immunizations(administration_date)`,
    `CREATE TABLE IF NOT EXISTS vaccine_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vaccine_code VARCHAR(20) NOT NULL,
      vaccine_name VARCHAR(255) NOT NULL,
      manufacturer VARCHAR(100),
      lot_number VARCHAR(50) NOT NULL,
      expiration_date DATE NOT NULL,
      quantity_received INTEGER NOT NULL,
      quantity_remaining INTEGER NOT NULL,
      quantity_administered INTEGER DEFAULT 0,
      quantity_wasted INTEGER DEFAULT 0,
      storage_location VARCHAR(100),
      storage_temperature_min DECIMAL(5,2),
      storage_temperature_max DECIMAL(5,2),
      status VARCHAR(50) DEFAULT 'active',
      received_date DATE NOT NULL,
      received_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_code ON vaccine_inventory(vaccine_code)`,
    `CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_status ON vaccine_inventory(status)`,
    `CREATE TABLE IF NOT EXISTS immunization_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_name VARCHAR(255) NOT NULL,
      vaccine_code VARCHAR(20) NOT NULL,
      vaccine_name VARCHAR(255) NOT NULL,
      age_group VARCHAR(50),
      minimum_age_months INTEGER,
      maximum_age_months INTEGER,
      dose_number INTEGER NOT NULL,
      recommended_age_months INTEGER,
      minimum_interval_days INTEGER,
      is_required BOOLEAN DEFAULT true,
      schedule_type VARCHAR(50) DEFAULT 'routine',
      contraindications JSONB DEFAULT '[]'::jsonb,
      effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_imm_schedules_type ON immunization_schedules(schedule_type)`,
    `CREATE INDEX IF NOT EXISTS idx_imm_schedules_code ON immunization_schedules(vaccine_code)`,
    `CREATE TABLE IF NOT EXISTS vaccine_adverse_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      immunization_id UUID NOT NULL,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      event_date TIMESTAMP WITH TIME ZONE NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(20),
      reported_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS immunization_forecasts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      vaccine_code VARCHAR(20) NOT NULL,
      vaccine_name VARCHAR(255) NOT NULL,
      dose_number INTEGER NOT NULL,
      recommended_date DATE,
      status VARCHAR(20) DEFAULT 'due',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    `INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
     SELECT 'Yellow Fever', 'YF', 'Yellow Fever (17D)', 'adult', 1, NULL, NULL, true, 'travel', CURRENT_DATE
     WHERE NOT EXISTS (SELECT 1 FROM immunization_schedules WHERE vaccine_code = 'YF' AND schedule_type = 'travel')`,
    `INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
     SELECT 'Typhoid Vi', '101', 'Typhoid Vi Polysaccharide', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE
     WHERE NOT EXISTS (SELECT 1 FROM immunization_schedules WHERE vaccine_code = '101' AND schedule_type = 'travel')`,
    `INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
     SELECT 'BCG', '19', 'BCG (Tuberculosis)', 'infant', 1, 0, NULL, true, 'routine', CURRENT_DATE
     WHERE NOT EXISTS (SELECT 1 FROM immunization_schedules WHERE vaccine_code = '19' AND schedule_type = 'routine')`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();

  try {
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        applied_by TEXT,
        notes TEXT
      )
    `);

    const versionRow = await tenantClient.query(
      `SELECT version FROM tenant_schema_versions WHERE bundle_id = $1 LIMIT 1`,
      [BUNDLE_ID],
    );

    if (versionRow.rowCount && versionRow.rows[0].version === BUNDLE_VERSION) {
      console.log(`⏭️  ${databaseName}: ${BUNDLE_ID}@${BUNDLE_VERSION} already applied`);
      return;
    }

    for (const statement of getStatements()) {
      await tenantClient.query(statement);
    }

    await tenantClient.query(
      `
        INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by, notes)
        VALUES ($1, $2, NOW(), $3, $4)
        ON CONFLICT (bundle_id) DO UPDATE
        SET version = EXCLUDED.version,
            applied_at = NOW(),
            applied_by = EXCLUDED.applied_by,
            notes = EXCLUDED.notes
      `,
      [
        BUNDLE_ID,
        BUNDLE_VERSION,
        'scripts/provision-sprint-e1-immunization-alignment.ts',
        'Sprint E1 immunization tables and travel vaccine schedule seed',
      ],
    );

    console.log(`✅ ${databaseName}: applied ${BUNDLE_ID}@${BUNDLE_VERSION}`);
  } finally {
    await tenantClient.end();
  }
}

async function main(): Promise<void> {
  const masterClient = new Client({
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'medicore_master',
  });

  await masterClient.connect();

  try {
    const columnsResult = await masterClient.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      `,
    );

    const columns = new Set<string>(columnsResult.rows.map((row) => String(row.column_name)));
    const dbNameColumn = columns.has('databaseName') ? 'databaseName' : columns.has('database_name') ? 'database_name' : '';
    const statusColumn = columns.has('status') ? 'status' : '';

    if (!dbNameColumn) {
      throw new Error('Unable to resolve tenant database-name column (expected databaseName or database_name).');
    }

    const query = `
      SELECT id, subdomain, ${quoteIdent(dbNameColumn)} AS database_name
      FROM tenants
      ${statusColumn ? `WHERE ${quoteIdent(statusColumn)} = 'active'` : ''}
      ORDER BY subdomain ASC
    `;

    const tenants = await masterClient.query(query);
    if (!tenants.rowCount) {
      console.log('No tenants found to provision.');
      return;
    }

    console.log(`Found ${tenants.rowCount} active tenant(s). Applying ${BUNDLE_ID}@${BUNDLE_VERSION}...`);

    for (const tenant of tenants.rows) {
      const databaseName = String(tenant.database_name || '').trim();
      const subdomain = String(tenant.subdomain || '').trim();

      if (!databaseName) {
        console.log(`⚠️  Skipping tenant ${subdomain || tenant.id} (missing database name)`);
        continue;
      }

      try {
        await applyToTenant(databaseName);
      } catch (error: any) {
        console.error(`❌ ${databaseName}: failed to apply ${BUNDLE_ID}: ${String(error?.message || error)}`);
        throw error;
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Provisioning failed:', error);
  process.exit(1);
});
