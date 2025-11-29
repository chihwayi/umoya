#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'string',
    demandOption: true,
    describe: 'Tenant subdomain to apply Sprint 7 oncology schema to',
  })
  .help()
  .alias('help', 'h')
  .parseSync() as { tenant: string };

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
      })
      .replace(/\/[^/]+$/, `/${databaseName}`);
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';
  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
}

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS oncology_imaging_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    imaging_study_id UUID REFERENCES imaging_studies(id) ON DELETE SET NULL,
    imaging_date DATE NOT NULL,
    imaging_type VARCHAR(100) NOT NULL,
    modality VARCHAR(50),
    findings TEXT,
    tumor_size_cm NUMERIC(6,2),
    tumor_location TEXT,
    lymph_nodes_involved INTEGER,
    metastatic_sites TEXT[] DEFAULT '{}'::text[],
    recist_response VARCHAR(10) CHECK (recist_response IN ('CR','PR','SD','PD','NE')),
    recist_criteria_met BOOLEAN,
    radiologist_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_imaging_findings_case_id ON oncology_imaging_findings(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_imaging_findings_date ON oncology_imaging_findings(imaging_date)`,
  `CREATE TABLE IF NOT EXISTS oncology_pathology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    pathology_report_id UUID,
    specimen_date DATE NOT NULL,
    specimen_type VARCHAR(100),
    histology_type VARCHAR(255),
    histology_snomed_code VARCHAR(50),
    histology_snomed_term TEXT,
    grade VARCHAR(50),
    stage_t VARCHAR(10),
    stage_n VARCHAR(10),
    stage_m VARCHAR(10),
    biomarkers JSONB DEFAULT '{}'::jsonb,
    genetic_testing JSONB DEFAULT '{}'::jsonb,
    genomic_data JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    pathologist_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_pathology_case_id ON oncology_pathology(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_pathology_specimen_date ON oncology_pathology(specimen_date)`,
  `ALTER TABLE oncology_pathology ADD COLUMN IF NOT EXISTS genomic_data JSONB DEFAULT '{}'::jsonb`,
  `CREATE TABLE IF NOT EXISTS oncology_response_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    regimen_id UUID REFERENCES oncology_regimens(id) ON DELETE SET NULL,
    assessment_date DATE NOT NULL,
    assessment_type VARCHAR(30) CHECK (assessment_type IN ('baseline','interim','end_of_treatment','follow_up')),
    recist_response VARCHAR(10) CHECK (recist_response IN ('CR','PR','SD','PD','NE')),
    best_overall_response VARCHAR(50),
    target_lesions_count INTEGER,
    target_lesions_size_cm NUMERIC(6,2),
    non_target_lesions_status VARCHAR(50),
    new_lesions BOOLEAN,
    assessed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_response_case_id ON oncology_response_assessments(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_response_date ON oncology_response_assessments(assessment_date)`,
  `CREATE TABLE IF NOT EXISTS oncology_survivorship_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    treatment_completion_date DATE,
    follow_up_schedule JSONB DEFAULT '{}'::jsonb,
    surveillance_imaging_schedule JSONB DEFAULT '{}'::jsonb,
    long_term_side_effects TEXT[] DEFAULT '{}'::text[],
    recurrence_risk VARCHAR(50),
    lifestyle_recommendations TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_survivorship_case_id ON oncology_survivorship_plans(oncology_case_id)`,
  `CREATE TABLE IF NOT EXISTS oncology_clinical_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    trial_name VARCHAR(255) NOT NULL,
    trial_id VARCHAR(100),
    trial_phase VARCHAR(50),
    enrollment_date DATE,
    enrollment_status VARCHAR(30) CHECK (enrollment_status IN ('screening','enrolled','on_treatment','completed','withdrawn')),
    protocol_compliance_percentage INTEGER,
    trial_endpoints JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_clinical_trials_case_id ON oncology_clinical_trials(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_clinical_trials_status ON oncology_clinical_trials(enrollment_status)`,
  `CREATE TABLE IF NOT EXISTS oncology_patient_reported_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    assessment_type VARCHAR(100) CHECK (assessment_type IN ('EORTC_QLQ_C30','FACT_G','symptom_tracking','functional_status','satisfaction')),
    assessment_data JSONB NOT NULL,
    total_score NUMERIC(6,2),
    domain_scores JSONB,
    completed_by_patient BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_pro_case_id ON oncology_patient_reported_outcomes(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_pro_assessment_date ON oncology_patient_reported_outcomes(assessment_date)`,
  `CREATE TABLE IF NOT EXISTS oncology_financial_toxicity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    total_cost_to_date NUMERIC(12,2),
    insurance_coverage_total NUMERIC(12,2),
    out_of_pocket_total NUMERIC(12,2),
    financial_assistance_total NUMERIC(12,2),
    financial_stress_score INTEGER CHECK (financial_stress_score BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_financial_toxicity_case_id ON oncology_financial_toxicity(oncology_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncology_financial_toxicity_date ON oncology_financial_toxicity(assessment_date)`,
  `ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS insurance_coverage_percentage NUMERIC(5,2)`,
  `ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS out_of_pocket_cost NUMERIC(12,2)`,
  `ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS financial_assistance_received BOOLEAN`,
  `ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS financial_assistance_program VARCHAR(255)`,
];

async function main() {
  const masterConn = resolveMasterConnection();
  const masterClient = new Client({ connectionString: masterConn });
  await masterClient.connect();

  try {
    const tenantResult = await masterClient.query(
      `
        SELECT "databaseName" AS database_name, "connectionString" AS connection_string
        FROM tenants
        WHERE subdomain = $1
        LIMIT 1
      `,
      [argv.tenant],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant ${argv.tenant} not found`);
    }

    const tenantInfo = tenantResult.rows[0];
    const tenantConn = normalizeTenantConnection(tenantInfo.connection_string, tenantInfo.database_name);
    console.log(`Applying Sprint 7 oncology schema to ${argv.tenant} (${tenantInfo.database_name})`);

    const tenantClient = new Client({ connectionString: tenantConn });
    await tenantClient.connect();
    try {
      for (const statement of statements) {
        console.log(`→ ${statement.split('\\n')[0].trim().slice(0, 80)}...`);
        await tenantClient.query(statement);
      }
      console.log('✅ Sprint 7 oncology schema applied successfully.');
    } finally {
      await tenantClient.end();
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply Sprint 7 oncology schema:', error);
  process.exit(1);
});



