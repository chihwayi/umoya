import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  TENANT_ENTITY_ALIGNMENT_BUNDLE_VERSION,
  TENANT_ENTITY_ALIGNMENT_STATEMENTS,
} from '../generated/tenant-entity-alignment.statements';
import {
  TENANT_ENTITY_STRUCTURE_ALIGNMENT_BUNDLE_VERSION,
  TENANT_ENTITY_STRUCTURE_ALIGNMENT_STATEMENTS,
} from '../generated/tenant-entity-structure-alignment.statements';
import {
  TENANT_ENTITY_SHADOW_CLEANUP_BUNDLE_VERSION,
  TENANT_ENTITY_SHADOW_CLEANUP_STATEMENTS,
} from '../generated/tenant-entity-shadow-cleanup.statements';
import {
  TENANT_EPI_REGISTRY_BUNDLE_VERSION,
  TENANT_EPI_REGISTRY_STATEMENTS,
} from '../generated/tenant-epi-registry.statements';
import {
  TENANT_OUTBREAK_SURVEILLANCE_BUNDLE_VERSION,
  TENANT_OUTBREAK_SURVEILLANCE_STATEMENTS,
} from '../generated/tenant-outbreak-surveillance.statements';
import {
  TENANT_MOBILE_MONEY_BUNDLE_VERSION,
  TENANT_MOBILE_MONEY_STATEMENTS,
} from '../generated/tenant-mobile-money.statements';
import {
  TENANT_CHW_MODULE_BUNDLE_VERSION,
  TENANT_CHW_MODULE_STATEMENTS,
} from '../generated/tenant-chw-module.statements';
import {
  TENANT_NUTRITION_CMAM_BUNDLE_VERSION,
  TENANT_NUTRITION_CMAM_STATEMENTS,
} from '../generated/tenant-nutrition-cmam.statements';
import {
  TENANT_NHIF_CBHI_BUNDLE_VERSION,
  TENANT_NHIF_CBHI_STATEMENTS,
} from '../generated/tenant-nhif-cbhi.statements';
import {
  TENANT_SA_NATIONAL_INTEROP_BUNDLE_VERSION,
  TENANT_SA_NATIONAL_INTEROP_STATEMENTS,
} from '../generated/tenant-sa-national-interop.statements';
import {
  TENANT_DHIS2_TRACKER_DATIM_BUNDLE_VERSION,
  TENANT_DHIS2_TRACKER_DATIM_STATEMENTS,
} from '../generated/tenant-dhis2-tracker-datim.statements';
import {
  TENANT_OPENMRS_MFL_BUNDLE_VERSION,
  TENANT_OPENMRS_MFL_STATEMENTS,
} from '../generated/tenant-openmrs-mfl.statements';
import {
  TENANT_CRVS_BUNDLE_VERSION,
  TENANT_CRVS_STATEMENTS,
} from '../generated/tenant-crvs.statements';
import {
  TENANT_AT_MESSAGING_BUNDLE_VERSION,
  TENANT_AT_MESSAGING_STATEMENTS,
} from '../generated/tenant-at-messaging.statements';
import {
  TENANT_NTD_MALARIA_BUNDLE_VERSION,
  TENANT_NTD_MALARIA_STATEMENTS,
} from '../generated/tenant-ntd-malaria.statements';
import {
  TENANT_MENTAL_HEALTH_MHGAP_BUNDLE_VERSION,
  TENANT_MENTAL_HEALTH_MHGAP_STATEMENTS,
} from '../generated/tenant-mental-health-mhgap.statements';
import {
  TENANT_CERVICAL_FP_BUNDLE_VERSION,
  TENANT_CERVICAL_FP_STATEMENTS,
} from '../generated/tenant-cervical-fp.statements';
import {
  TENANT_HTN_NCD_BUNDLE_VERSION,
  TENANT_HTN_NCD_STATEMENTS,
} from '../generated/tenant-htn-ncd.statements';
import {
  TENANT_TM_HDI_BUNDLE_VERSION,
  TENANT_TM_HDI_STATEMENTS,
} from '../generated/tenant-tm-hdi.statements';
import {
  TENANT_SCD_BUNDLE_VERSION,
  TENANT_SCD_STATEMENTS,
} from '../generated/tenant-scd.statements';
import {
  TENANT_EPILEPSY_BUNDLE_VERSION,
  TENANT_EPILEPSY_STATEMENTS,
} from '../generated/tenant-epilepsy.statements';
import {
  TENANT_VHF_CASE_MANAGEMENT_BUNDLE_VERSION,
  TENANT_VHF_CASE_MANAGEMENT_STATEMENTS,
} from '../generated/tenant-vhf-case-management.statements';
import {
  TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION,
  TENANT_ONE_HEALTH_PACTR_STATEMENTS,
} from '../generated/tenant-one-health-pactr.statements';
import {
  TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION,
  TENANT_REPORTING_COMPLETENESS_STATEMENTS,
} from '../generated/tenant-reporting-completeness.statements';
import {
  TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION,
  TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS,
} from '../generated/tenant-maternal-mortality-emonc.statements';
import {
  TENANT_NCD_COMPLICATIONS_BUNDLE_VERSION,
  TENANT_NCD_COMPLICATIONS_STATEMENTS,
} from '../generated/tenant-ncd-complications.statements';
import {
  TENANT_PLAGUE_YFM_BUNDLE_VERSION,
  TENANT_PLAGUE_YFM_STATEMENTS,
} from '../generated/tenant-plague-yfm-protocols.statements';
import {
  TENANT_NTD_DEPTH_BUNDLE_VERSION,
  TENANT_NTD_DEPTH_STATEMENTS,
} from '../generated/tenant-ntd-clinical-depth.statements';
import {
  TENANT_TBA_BIRTH_BUNDLE_VERSION,
  TENANT_TBA_BIRTH_STATEMENTS,
} from '../generated/tenant-tba-birth-registration.statements';
import {
  TENANT_SORMAS_IHR_BUNDLE_VERSION,
  TENANT_SORMAS_IHR_STATEMENTS,
} from '../generated/tenant-sormas-ihr-pipeline.statements';
import {
  TENANT_CBHI_DEEP_BUNDLE_VERSION,
  TENANT_CBHI_DEEP_STATEMENTS,
} from '../generated/tenant-cbhi-deep-module.statements';
import {
  TENANT_LANGUAGE_PREFS_BUNDLE_VERSION,
  TENANT_LANGUAGE_PREFS_STATEMENTS,
} from '../generated/tenant-language-preferences.statements';
import {
  TENANT_DISA_SMARTCARE_BUNDLE_VERSION,
  TENANT_DISA_SMARTCARE_STATEMENTS,
} from '../generated/tenant-disa-smartcare.statements';
import {
  TENANT_LOW_BANDWIDTH_BUNDLE_VERSION,
  TENANT_LOW_BANDWIDTH_STATEMENTS,
} from '../generated/tenant-low-bandwidth-lite.statements';
import {
  TENANT_UBUNTU_BUNDLE_VERSION,
  TENANT_UBUNTU_STATEMENTS,
} from '../generated/tenant-ubuntu-cultural-health.statements';
import {
  TENANT_UHC_SDG_BUNDLE_VERSION,
  TENANT_UHC_SDG_STATEMENTS,
} from '../generated/tenant-uhc-sdg-indicators.statements';
import {
  TENANT_NCID_BUNDLE_VERSION,
  TENANT_NCID_STATEMENTS,
} from '../generated/tenant-ncid.statements';

interface ProvisioningBundle {
  id: string;
  label: string;
  version: string;
  description?: string;
  statements?: (() => string[]) | string[];
  triggers?: () => string[];
  tasks?: Array<(tenantDb: DataSource) => Promise<void>>;
}

interface ProvisioningBundleManifest {
  id: string;
  label: string;
  version: string;
  description?: string;
}

interface ApplySchemaOptions {
  bundles?: string[];
  appliedBy?: string;
  strict?: boolean;
  maxPasses?: number;
  tenantSlug?: string;
}

interface ApplySchemaResult {
  pendingBundles: Array<{
    bundleId: string;
    version: string;
    attempts: number;
    lastError: string;
  }>;
}

@Injectable()
export class DatabaseProvisioningService {
  private readonly logger = new Logger(DatabaseProvisioningService.name);

  constructor(private dataSource: DataSource) {}

  private assertSafeDatabaseName(databaseName: string): void {
    // Allow quoted Postgres identifier characters we use in generated tenant DB names.
    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new Error(`Unsafe database name: ${databaseName}`);
    }
  }

  private emitProvisioningEvent(event: string, details: Record<string, any>) {
    this.logger.log(JSON.stringify({ source: 'provisioning', event, ...details }));
  }

  public getProvisioningBundlesManifest(): ProvisioningBundleManifest[] {
    return this.getProvisioningBundles().map(({ id, label, version, description }) => ({
      id,
      label,
      version,
      description,
    }));
  }

  private normalizeStatements(statements: string[]): string[] {
    return statements.map((s) =>
      s
        .replace(/CREATE TABLE\s+([^(]+)/gi, (m) => m.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'))
        .replace(/CREATE INDEX\s+/gi, 'CREATE INDEX IF NOT EXISTS ')
        .replace(/ADD COLUMN\s+/gi, 'ADD COLUMN IF NOT EXISTS ')
        .replace(/CREATE EXTENSION\s+/gi, 'CREATE EXTENSION IF NOT EXISTS ')
        .replace(/IF NOT EXISTS\s+IF NOT EXISTS/gi, 'IF NOT EXISTS'),
    );
  }

  private resolveBundleStatements(bundle: ProvisioningBundle): string[] {
    if (!bundle.statements) {
      return [];
    }
    const statements = typeof bundle.statements === 'function'
      ? bundle.statements()
      : bundle.statements;
    return this.normalizeStatements(statements);
  }

  private async ensureSchemaVersionTable(tenantDb: DataSource) {
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        applied_by TEXT,
        notes TEXT
      )
    `);
  }

  private async hasBundleVersion(tenantDb: DataSource, bundleId: string, version: string): Promise<boolean> {
    const result = await tenantDb.query(
      `SELECT version FROM tenant_schema_versions WHERE bundle_id = $1 LIMIT 1`,
      [bundleId],
    );
    if (!result || result.length === 0) {
      return false;
    }
    return result[0].version === version;
  }

  private async recordBundleVersion(
    tenantDb: DataSource,
    bundleId: string,
    version: string,
    appliedBy: string,
  ): Promise<void> {
    await tenantDb.query(
      `
        INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (bundle_id) DO UPDATE
        SET version = EXCLUDED.version,
            applied_at = NOW(),
            applied_by = EXCLUDED.applied_by
      `,
      [bundleId, version, appliedBy],
    );
  }

  private async ensureUpdatedAtTriggerFunction(tenantDb: DataSource) {
    await tenantDb.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
  }

  private async enforceUserRoleConstraint(tenantDb: DataSource) {
    try {
      await tenantDb.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
      await tenantDb.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('doctor', 'nurse', 'nurse_accounts', 'receptionist', 'admin', 'pharmacist', 'lab_tech', 'radiologist', 'accounts'));
      `);
    } catch (e) {
      this.logger.warn(`Skipping constraint update due to error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private getProvisioningBundles(): ProvisioningBundle[] {
    return [
      {
        id: 'core',
        label: 'Core Clinic Schema',
        version: '2025.03.04',
        description: 'Baseline tables, triggers, and seed data for every tenant',
        statements: () => this.getClinicSchema(),
        triggers: () => this.getTriggerStatements(),
        tasks: [
          (db) => this.ensureUpdatedAtTriggerFunction(db),
          (db) => this.enforceUserRoleConstraint(db),
          (db) => this.seedLabCatalog(db),
          (db) => this.seedImagingCatalog(db),
          (db) => this.seedLookupTables(db),
          (db) => this.seedClinicalNoteTemplates(db),
          (db) => this.seedPrescriptionTemplates(db),
        ],
      },
      {
        id: 'snomed',
        label: 'SNOMED Enablement',
        version: '2025.03.01',
        description: 'Extends schema with SNOMED CT concept columns, indexes, and caches',
        tasks: [(db) => this.applySnomedUpgrades(db)],
      },
      {
        id: 'hiv_testing',
        label: 'HIV Testing Enhancements',
        version: '2025.03.01',
        description: 'Ensures HIV testing workflows and lookup tables are provisioned',
        tasks: [(db) => this.applyHivTestingUpgrades(db)],
      },
      {
        id: 'hiv_regimen_hardening',
        label: 'HIV Regimen Contraindication Matrix',
        version: '2026.02.22',
        description: 'Adds regimen contraindication matrix tables and baseline WHO/Zimbabwe guardrail rules',
        statements: () => this.getHivRegimenHardeningStatements(),
        tasks: [(db) => this.seedHivRegimenContraindicationMatrix(db)],
      },
      // ICD-10 Mapping bundle removed to enforce master-only terminology storage
      /*{
        id: 'icd10_mapping',
        label: 'ICD-10 Mapping Tables',
        version: '2025.03.01',
        description: 'Provides SNOMED → ICD-10 mapping storage and metadata tracking',
        statements: () => this.getIcd10MappingStatements(),
      },*/
      {
        id: 'sprint5_features',
        label: 'Sprint 5 Features',
        version: '2025.03.02',
        description: 'Waitlist management, invoice enhancements, order templates, and vital trends',
        statements: () => this.getSprint5SchemaStatements(),
      },
      {
        id: 'sprint6_diabetes',
        label: 'Sprint 6 - Diabetes Management',
        version: '2025.03.10',
        description: 'Diabetes registry, care bundles, glucose tracking, alerts, and device integration',
        statements: () => this.getSprint6DiabetesSchemaStatements(),
      },
      {
        id: 'sprint7_oncology',
        label: 'Sprint 7 - Oncology Enhancements',
        version: '2025.04.01',
        description: 'Imaging findings, pathology/biomarkers, response assessments, survivorship, trials, PROs, and financial toxicity tracking',
        statements: () => this.getSprint7OncologySchemaStatements(),
      },
      {
        id: 'sprint8_pharmacy',
        label: 'Sprint 8 - Pharmacy Management System',
        version: '2025.11.29',
        description: 'Complete pharmacy management with inventory tracking, purchase orders, dispensing, returns, pricing rules, and formulary checking',
        statements: () => this.getSprint8PharmacySchemaStatements(),
      },
      {
        id: 'appointment_enhancements',
        label: 'Appointment Enhancements - Doctor Availability',
        version: '2025.12.01',
        description: 'Doctor availability management to prevent appointments during unavailable times',
        statements: () => this.getAppointmentEnhancementsSchemaStatements(),
      },
      {
        id: 'billing_claims_enhancements',
        label: 'Billing & Claims Enhancements',
        version: '2025.11.29',
        description: 'Enhanced billing table structure and medical aid claims schema updates',
        statements: () => this.getBillingClaimsEnhancementsStatements(),
      },
      {
        id: 'sprint9_telemedicine',
        label: 'Sprint 9 - Telemedicine Platform',
        version: '2025.12.01',
        description: 'Telemedicine consultations, remote patient monitoring, digital prescriptions, and consent management',
        statements: () => this.getTelemedicineSchemaStatements(),
      },
      {
        id: 'sprint10_analytics',
        label: 'Sprint 10 - Advanced Analytics & Reporting',
        version: '2025.12.01',
        description: 'Custom report builder, scheduled reports, clinical outcomes tracking, and analytics metrics',
        statements: () => this.getAnalyticsSchemaStatements(),
      },
      {
        id: 'sprint13_eprescription',
        label: 'Sprint 13.3 - ePrescription Download',
        version: '2025.12.15',
        description: 'Prescription PDF download functionality with audit logging',
        statements: () => this.getPrescriptionDownloadSchemaStatements(),
      },
      {
        id: 'sprint15_pro',
        label: 'Sprint 15 - Patient-Reported Outcomes (PROs)',
        version: '2025.12.20',
        description: 'Patient-Reported Outcomes system with questionnaires, responses, scheduling, and alerts',
        statements: () => this.getProSchemaStatements(),
      },
      {
        id: 'sprint13_7_health_goals',
        label: 'Sprint 13.7 - Health Goals & Progress Tracking',
        version: '2025.12.21',
        description: 'Patient health goals, progress tracking, achievements, and gamification',
        statements: () => this.getHealthGoalsSchemaStatements(),
      },
      {
        id: 'sprint14_2_claims_enhancement',
        label: 'Sprint 14.2 - Medical Aid Claims Processing Enhancement',
        version: '2025.12.22',
        description: 'Enhanced claims processing with pre-authorization, status tracking, API integrations, and rejection handling',
        statements: () => this.getSprint14_2ClaimsEnhancementStatements(),
      },
      {
        id: 'sprint16_workflow_engine',
        label: 'Sprint 16 - Clinical Workflow Engine',
        version: '2025.12.23',
        description: 'Automated clinical workflows with triggers, steps, execution tracking, and templates',
        statements: () => this.getSprint16WorkflowSchemaStatements(),
      },
      {
        id: 'sprint17_care_plans',
        label: 'Sprint 17 - Structured Care Plans',
        version: '2025.12.02',
        description: 'Structured care plans with templates, goals, interventions, progress tracking, and outcomes',
        statements: () => this.getSprint17CarePlansSchemaStatements(),
      },
      {
        id: 'sprint18_referral_management',
        label: 'Sprint 18 - Referral Management System',
        version: '2025.12.02',
        description: 'Complete referral workflow system with templates, facilities directory, attachments, and status tracking',
        statements: () => this.getSprint18ReferralManagementSchemaStatements(),
      },
      {
        id: 'referralTransportColumns',
        label: 'Referral transport columns',
        version: '2026.05.08.1',
        description: 'Adds receiving facility webhook transport column to referrals table',
        statements: () => [
          `
          ALTER TABLE referrals
            ADD COLUMN IF NOT EXISTS referred_to_facility_webhook VARCHAR(500) DEFAULT NULL
          `,
        ],
      },
      {
        id: 'sprint19_document_management',
        label: 'Sprint 19 - Document Management UI',
        version: '2025.12.02',
        description: 'Document versioning, sharing, signatures, tags, and access logging for patient documents',
        statements: () => this.getSprint19DocumentManagementSchemaStatements(),
      },
      {
        id: 'sprint20_provider_messaging',
        label: 'Sprint 20 - Provider Messaging/Inbox',
        version: '2025.12.02',
        description: 'Secure provider-to-provider messaging with threads, attachments, tasks, and templates',
        statements: () => this.getSprint20ProviderMessagingSchemaStatements(),
      },
      {
        id: 'sprint21_econsent',
        label: 'Sprint 21 - E-Consent Management',
        version: '2026.03.12',
        description: 'Consent templates, patient consents, signatures, reminders, and audit trail foundation',
        statements: () => this.getSprint21EConsentSchemaStatements(),
      },
      {
        id: 'sprint31_revenue_cycle',
        label: 'Sprint 31 - Revenue Cycle & Charge Capture',
        version: '2025.12.05',
        description: 'Charge master, patient charges, DRG assignments, missed charges detection, and approval workflow',
        statements: () => this.getSprint31RevenueCycleSchemaStatements(),
      },
      {
        id: 'sprint23_bed_management',
        label: 'Sprint 23 - Bed Management & ADT',
        version: '2026.02.06',
        description: 'Advanced bed management, ADT workflows, and census tracking',
        statements: () => this.getSprint23BedManagementSchemaStatements(),
      },
      {
        id: 'sprint26_operating_room',
        label: 'Sprint 26 - Operating Room Management',
        version: '2026.03.12',
        description: 'OR scheduling, surgical cases, preference cards, block time, implant tracking, supply usage, and turnover',
        statements: () => this.getSprint26OperatingRoomSchemaStatements(),
      },
      {
        id: 'sprint27_anesthesia',
        label: 'Sprint 27 - Anesthesia Module',
        version: '2026.03.12',
        description: 'Pre-anesthesia assessments, anesthesia records, vitals charting, PACU records, and ASA billing',
        statements: () => this.getSprint27AnesthesiaSchemaStatements(),
      },
      {
        id: 'sprint28_bcma',
        label: 'Sprint 28 - BCMA Medication Safety',
        version: '2025.12.05',
        description: 'Barcode medication administration, 5 Rights verification, medication alerts, and audit logging',
        statements: () => this.getSprint28BCMASchemaStatements(),
      },
      {
        id: 'sprint29_blood_bank',
        label: 'Sprint 29 - Blood Bank Management',
        version: '2025.12.05',
        description: 'Donor registry, blood inventory, cross-matching, and transfusion documentation',
        statements: () => this.getSprint29BloodBankSchemaStatements(),
      },
      {
        id: 'sprint30_infection_control',
        label: 'Sprint 30 - Infection Control',
        version: '2025.12.05',
        description: 'HAI surveillance, isolation precautions, antimicrobial stewardship, outbreak alerts, and hand hygiene',
        statements: () => this.getSprint30InfectionControlSchemaStatements(),
      },
      {
        id: 'sprint32_cdi',
        label: 'Sprint 32 - Clinical Documentation Improvement',
        version: '2025.12.05',
        description: 'CDI reviews, physician queries, documentation completeness, and DRG impact analysis',
        statements: () => this.getSprint32CDISchemaStatements(),
      },
      {
        id: 'sprint33_case_management',
        label: 'Sprint 33 - Case Management & Discharge Planning',
        version: '2025.12.05',
        description: 'Case management assessments, discharge plans, utilization reviews, and care coordination',
        statements: () => this.getSprint33CaseManagementSchemaStatements(),
      },
      {
        id: 'sprint34_dietary',
        label: 'Sprint 34 - Dietary & Nutrition',
        version: '2025.12.05',
        description: 'Diet orders, nutritional assessments, meal planning, and tube feeding management',
        statements: () => this.getSprint34DietarySchemaStatements(),
      },
      {
        id: 'sprint35_respiratory',
        label: 'Sprint 35 - Respiratory Therapy',
        version: '2025.12.05',
        description: 'Respiratory orders, oxygen therapy, nebulizer treatments, and ventilator management',
        statements: () => this.getSprint35RespiratorySchemaStatements(),
      },
      {
        id: 'sprint36_physical_therapy',
        label: 'Sprint 36 - Physical Therapy',
        version: '2025.12.05',
        description: 'Therapy orders, PT/OT/Speech therapy documentation, and rehabilitation tracking',
        statements: () => this.getSprint36PhysicalTherapySchemaStatements(),
      },
      {
        id: 'sprint37_supply_chain',
        label: 'Sprint 37 - Supply Chain Management',
        version: '2025.12.05',
        description: 'Supply inventory, par levels, ordering, and usage tracking',
        statements: () => this.getSprint37SupplyChainSchemaStatements(),
      },
      {
        id: 'sprint38_sepsis',
        label: 'Sprint 38 - Sepsis Management',
        version: '2025.12.05',
        description: 'Sepsis screening, SEP-1 bundle tracking, and outcomes monitoring',
        statements: () => this.getSprint38SepsisSchemaStatements(),
      },
      {
        id: 'sprint39_advanced_nursing',
        label: 'Sprint 39 - Advanced Nursing',
        version: '2025.12.05',
        description: 'Falls risk assessments, wound care, and advanced nursing documentation',
        statements: () => this.getSprint39AdvancedNursingSchemaStatements(),
      },
      {
        id: 'sprint40_patient_safety',
        label: 'Sprint 40 - Patient Safety Reporting',
        version: '2025.12.05',
        description: 'Safety incident reporting, investigation tracking, and root cause analysis',
        statements: () => this.getSprint40PatientSafetySchemaStatements(),
      },
      {
        id: 'sprint41_quality_reporting',
        label: 'Sprint 41 - Quality Reporting',
        version: '2025.12.05',
        description: 'Quality measures, core measures tracking, and compliance reporting',
        statements: () => this.getSprint41QualityReportingSchemaStatements(),
      },
      {
        id: 'sprint42_advanced_analytics',
        label: 'Sprint 42 - Advanced Analytics',
        version: '2025.12.05',
        description: 'Analytics reports, executive metrics, and business intelligence',
        statements: () => this.getSprint42AdvancedAnalyticsSchemaStatements(),
      },
      {
        id: 'sprint45_drug_enhancement',
        label: 'Sprint 45 - Drug Database Enhancement (RxNorm)',
        version: '2025.12.06',
        description: 'Enhanced drug entity with RxNorm, SNOMED CT, NDC codes, strength, unit, and status fields for FHIR Medication support',
        statements: () => this.getSprint45DrugEnhancementSchemaStatements(),
      },
      {
        id: 'sprint45_pharmacy_dispensing_enhancement',
        label: 'Sprint 45 - Pharmacy Dispensing Enhancement',
        version: '2025.12.06',
        description: 'Add dispensing_number, total_amount, amount_paid, discount_amount columns to pharmacy_dispensings table',
        statements: () => this.getSprint45PharmacyDispensingEnhancementSchemaStatements(),
      },
      {
        id: 'who_smart_forms_data',
        label: 'WHO Smart Forms Data Storage',
        version: '2024.12.09',
        description: 'Adds JSONB columns to store complete WHO Smart Forms data for audit trail and data integrity',
        statements: () => this.getWhoSmartFormsDataSchemaStatements(),
      },
      {
        id: 'gateway_configurations',
        label: 'SMS & Payment Gateway Configurations',
        version: '2026.02.04',
        description: 'Tables for storing tenant-specific SMS and Payment gateway configurations',
        statements: () => this.getGatewayConfigurationStatements(),
      },
      {
        id: 'portal_enhancements',
        label: 'Patient Portal Enhancements',
        version: '2026.02.06',
        description: 'Adds portal access columns to patients and patient_messages table',
        statements: () => this.getPortalEnhancementStatements(),
      },
      {
        id: 'sprint46_nurse_copilot',
        label: 'Sprint 46 - Nurse Copilot Persistence',
        version: '2026.02.16',
        description: 'Server-side nurse copilot state tables for tasks, alerts, and handoff workflow lifecycle',
        statements: () => this.getSprint46NurseCopilotSchemaStatements(),
      },
      {
        id: 'sprint47_nurse_cross_module_workflow',
        label: 'Sprint 47 - Nurse Cross-Module Workflow',
        version: '2026.03.04',
        description: 'Shared workflow state for HIV, handoff, and medication escalations in the nurse cross-module queue',
        statements: () => this.getSprint47NurseCrossModuleWorkflowSchemaStatements(),
      },
      {
        id: 'sprint48_post_visit_companion',
        label: 'Sprint 48 - Post-Visit AI Companion Core',
        version: '2026.03.05',
        description: 'Post-visit session lifecycle persistence for transcription segments, extracted entities, and draft artifacts',
        statements: () => this.getSprint48PostVisitCompanionSchemaStatements(),
      },
      {
        id: 'sprint49_post_visit_review_citations',
        label: 'Sprint 49 - Post-Visit Review and Citation Mapping',
        version: '2026.03.05',
        description: 'Adds doctor review action persistence and normalized guideline citation mapping per recommendation rule',
        statements: () => this.getSprint49PostVisitReviewCitationSchemaStatements(),
      },
      {
        id: 'sprint50_post_visit_execution_actions',
        label: 'Sprint 50 - Post-Visit Executable Recommendation Actions',
        version: '2026.03.05',
        description: 'Adds idempotent execution persistence for post-visit recommendation one-click actions',
        statements: () => this.getSprint50PostVisitExecutionActionSchemaStatements(),
      },
      {
        id: 'sprint51_post_visit_patient_companion_escalations',
        label: 'Sprint 51 - Post-Visit Patient Companion Messaging and Escalations',
        version: '2026.03.05',
        description: 'Adds patient companion chat persistence, teach-back acknowledgements, and escalation routing events',
        statements: () => this.getSprint51PostVisitCompanionEscalationSchemaStatements(),
      },
      {
        id: 'sprint52_post_visit_intravisit_routing_sla',
        label: 'Sprint 52 - Post-Visit Intra-Visit Routing and SLA',
        version: '2026.03.06',
        description: 'Adds clinician routing policy metadata and acknowledgement SLA timers for intra-visit live safety alerts',
        statements: () => this.getSprint52PostVisitIntraVisitRoutingSchemaStatements(),
      },
      {
        id: 'sprint53_post_visit_billing_intelligence',
        label: 'Sprint 53 - Post-Visit Billing Intelligence',
        version: '2026.03.06',
        description: 'Adds billing suggestion intelligence persistence and approval audit trail for post-visit workflow',
        statements: () => this.getSprint53PostVisitBillingIntelligenceSchemaStatements(),
      },
      {
        id: 'sprint54_post_visit_previsit_briefs',
        label: 'Sprint 54 - Post-Visit Pre-Visit Briefs and Follow-Up Risk',
        version: '2026.03.06',
        description: 'Adds appointment pre-visit briefing persistence with follow-up risk scoring and nudge policy metadata',
        statements: () => this.getSprint54PostVisitPreVisitBriefSchemaStatements(),
      },
      {
        id: 'sprint55_post_visit_admin_docs_voice_review',
        label: 'Sprint 55 - Post-Visit Admin Docs and Voice Review',
        version: '2026.03.06',
        description: 'Adds signed admin document persistence and immutable hash trail for voice-driven doctor workflow',
        statements: () => this.getSprint55PostVisitAdminDocsSchemaStatements(),
      },
      {
        id: 'sprint56_post_visit_trials_memory',
        label: 'Sprint 56 - Post-Visit Trial Matcher and Companion Memory',
        version: '2026.03.06',
        description: 'Adds de-identified clinical trial match persistence and longitudinal companion memory state',
        statements: () => this.getSprint56PostVisitTrialMemorySchemaStatements(),
      },
      {
        id: 'sprint57_post_visit_document_intelligence_notifications',
        label: 'Sprint 57 - Post-Visit Document Intelligence and Patient Notifications',
        version: '2026.03.06',
        description: 'Backfills OCR document intelligence persistence and patient notification tables so tenant repair fully provisions post-visit flows',
        statements: () => this.getSprint57PostVisitDocumentIntelligenceAndNotificationsSchemaStatements(),
      },
      {
        id: 'sprint58_post_visit_audio_storage',
        label: 'Post-Visit Audio Storage',
        version: '2026.03.07',
        description: 'Adds recording storage columns to post_visit_sessions',
        statements: () => this.getSprint58PostVisitAudioStorageSchemaStatements(),
      },
      {
        id: 'sprint_e1_immunization_alignment',
        label: 'Sprint E1 Immunization API Alignment',
        version: '2026.03.08',
        description: 'Adds immunization tables and vaccine schedule seed (routine + travel)',
        statements: () => this.getSprintE1ImmunizationAlignmentStatements(),
      },
      {
        id: 'sprint_e3_2fa',
        label: 'Sprint E3 Two-Factor Authentication',
        version: '2026.03.08',
        description: 'Adds users two_factor_secret and two_factor_enabled columns',
        statements: () => this.getSprintE3_2FAStatements(),
      },
      {
        id: 'sprint_f1_or_surgical_safety',
        label: 'Sprint F1 OR Surgical Safety + Counts + Specimens',
        version: '2026.03.12',
        description: 'WHO checklist, count sheets, specimen tracking tables',
        statements: () => this.getSprintF1ORSurgicalSafetyStatements(),
      },
      {
        id: 'sprint_f2_blood_bank_crossmatch',
        label: 'Sprint F2 Blood Bank Crossmatch + Transfusion Reactions',
        version: '2026.03.08',
        description: 'blood_cross_match and transfusion_reactions tables',
        statements: () => this.getSprintF2BloodBankCrossmatchStatements(),
      },
      {
        id: 'sprint_f3_infection_sepsis',
        label: 'Sprint F3 Infection Control + Sepsis Bundle',
        version: '2026.03.08',
        description: 'Hand hygiene, device days, sepsis_bundles timestamp columns',
        statements: () => this.getSprintF3InfectionSepsisStatements(),
      },
      {
        id: 'sprint_f4_bcma_mar',
        label: 'Sprint F4 BCMA Prescription-to-MAR',
        version: '2026.03.08',
        description: 'mar_scheduled_entries for prescription-to-MAR and witness workflow',
        statements: () => this.getSprintF4BcmaMarStatements(),
      },
      {
        id: 'sprint_g2_encounter_coding',
        label: 'Sprint G2 Encounter Auto-Coding (ICD/CPT)',
        version: '2026.03.08',
        description: 'encounter_code_suggestions for ICD-10/CPT suggestions and review',
        statements: () => this.getSprintG2EncounterCodingStatements(),
      },
      {
        id: 'sprint_g3_scheduling_ai',
        label: 'Sprint G3 Predictive Scheduling + No-Show AI',
        version: '2026.03.08',
        description: 'appointment_no_show_predictions for no-show risk and smart slots',
        statements: () => this.getSprintG3SchedulingAiStatements(),
      },
      {
        id: 'sprint_g4_population_health',
        label: 'Sprint G4 Population Health Registry + Preventive Care',
        version: '2026.03.08',
        description: 'chronic_disease_registry, preventive_care_reminders, recall_lists',
        statements: () => this.getSprintG4PopulationHealthStatements(),
      },
      {
        id: 'sprint_h1_practice_management',
        label: 'Sprint H1 Fee Schedule + Superbill + Insurance Verification',
        version: '2026.03.09',
        description: 'fee_schedules, fee_schedule_items, superbill_templates, insurance_verifications',
        statements: () => this.getSprintH1PracticeManagementStatements(),
      },
      {
        id: 'sprint_h2_prior_authorization',
        label: 'Sprint H2 Prior Authorization Workflow',
        version: '2026.03.09',
        description: 'prior_authorizations table and indexes',
        statements: () => this.getSprintH2PriorAuthorizationStatements(),
      },
      {
        id: 'sprint_h3_patient_portal',
        label: 'Sprint H3 Patient Portal: Payments + Education + Family Access',
        version: '2026.03.09',
        description: 'patient_portal_payments, health_education_content, patient_family_access',
        statements: () => this.getSprintH3PatientPortalStatements(),
      },
      {
        id: 'patientFamilyAccessPasswordColumn',
        label: 'Patient family access password column',
        version: '2026.05.11.1',
        description: 'Adds password_hash column to patient_family_access for caregiver portal login',
        statements: () => [
          `ALTER TABLE patient_family_access
           ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
           ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ NULL,
           ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL`,
          `CREATE INDEX IF NOT EXISTS idx_family_access_proxy_email
           ON patient_family_access(proxy_email) WHERE is_active = true`,
        ],
      },
      {
        id: 'sprint111_financial_intelligence',
        label: 'Sprint 111 Financial Intelligence',
        version: '2026.03.25.5',
        description: 'payment provider events, financial clearance intelligence, prior-auth drafts, and reconciliation anomaly controls',
        statements: () => this.getSprint111FinancialIntelligenceStatements(),
      },
      {
        id: 'sprint_h4_recall_campaigns',
        label: 'Sprint H4 Recall Campaigns + Bulk Notifications',
        version: '2026.03.09',
        description: 'notification_campaigns and notification_campaign_recipients',
        statements: () => this.getSprintH4RecallCampaignStatements(),
      },
      {
        id: 'sprint_i1_travel_vaccines',
        label: 'Sprint I1 Travel Vaccine Engine + Yellow Card',
        version: '2026.03.09',
        description: 'travel_vaccine_destinations, vaccination_certificates + seed destination requirements',
        statements: () => this.getSprintI1TravelVaccineStatements(),
      },
      {
        id: 'sprint_i2_multi_currency_medical_aid',
        label: 'Sprint I2 Multi-Currency Billing + Medical Aid Stubs',
        version: '2026.03.09',
        description: 'billing currency fields, exchange rates, medical aid providers + eligibility + remittance stubs',
        statements: () => this.getSprintI2MultiCurrencyMedicalAidStatements(),
      },
      {
        id: 'sprint_j2_early_warning',
        label: 'Sprint J2 Deterioration Detection + Early Warning Score (NEWS2)',
        version: '2026.03.09',
        description: 'patient_early_warning_scores table and indexes',
        statements: () => this.getSprintJ2EarlyWarningStatements(),
      },
      {
        id: 'sprint111_vitals_operational',
        label: 'Sprint 111 Vitals Baselines + Escalation + Remote Monitoring',
        version: '2026.03.26.2',
        description: 'patient_vital_baselines, clinical_escalation_tasks, remote_monitoring_events, remote_monitoring_alerts, and device provenance columns for wearable ingestion',
        statements: () => this.getSprint111VitalsOperationalStatements(),
      },
      {
        id: 'maternity_care_tasks',
        label: 'Maternity Care Task Workflow',
        version: '2026.03.04',
        description: 'Adds maternity escalation task persistence for nurse-doctor workflow state transitions',
        statements: () => this.getMaternityCareTaskSchemaStatements(),
      },
      {
        id: 'medication_reminders',
        label: 'Medication Reminders',
        version: '2026.02.12',
        description: 'Adds medication_reminders table for tracking patient medication adherence reminders',
        statements: () => this.getMedicationRemindersSchemaStatements(),
      },
      {
        id: 'dhis2_sync_foundation',
        label: 'DHIS2 Sync Foundation',
        version: '2026.03.10',
        description: 'Tenant-level patient TEI mapping and sync audit log tables for idempotent DHIS2 push',
        statements: () => this.getDhis2SyncFoundationStatements(),
      },
      {
        id: 'sprint_l1_continuous_learning',
        label: 'Continuous Learning Infrastructure',
        version: '2026.03.07',
        description: 'ML feedback loop tables: model metrics, training snapshots, coding corpus, and prediction outcome tracking',
        statements: () => this.getSprintL1ContinuousLearningStatements(),
      },
      {
        id: 'sprint59_vitals_extended',
        label: 'Sprint 59 - Extended Vitals',
        version: '2026.03.18',
        description: 'Extended vitals: waist, hip, bmi, spo2, pain scale, pupil, glasgow coma, growth/developmental fields',
        statements: () => this.getSprint59VitalsExtendedStatements(),
      },
      {
        id: 'sprint60_patient_extended_sdoh',
        label: 'Sprint 60 - Patient Extended Fields + SDOH',
        version: '2026.03.18',
        description: 'Patient entity extensions: disability, preferred language, next of kin, insurance, SDOH screening columns',
        statements: () => this.getSprint60PatientExtendedSdohStatements(),
      },
      {
        id: 'sprint61_cdss_outcome_feedback',
        label: 'Sprint 61 - CDSS Outcome Feedback Loop',
        version: '2026.03.18',
        description: 'cdss_decision_logs, cdss_outcome_feedback, cdss_model_metrics tables for AI learning loop',
        statements: () => this.getSprint61CdssOutcomeFeedbackStatements(),
      },
      {
        id: 'sprint62_proactive_care_gaps',
        label: 'Sprint 62 - Proactive Care Gap Engine',
        version: '2026.03.18',
        description: 'care_gaps, care_gap_rules, care_gap_actions tables for proactive population health',
        statements: () => this.getSprint62ProactiveCareGapsStatements(),
      },
      {
        id: 'sprint63_ambient_ai',
        label: 'Sprint 63 - Ambient AI Transcription',
        version: '2026.03.18',
        description: 'ambient_sessions, ambient_transcripts, ambient_soap_notes tables for real-time visit capture',
        statements: () => this.getSprint63AmbientAiStatements(),
      },
      {
        id: 'sprint64_pre_charting',
        label: 'Sprint 64 - Pre-Charting AI',
        version: '2026.03.18',
        description: 'encounter_precharts table for AI-generated pre-visit summaries and clinical prep',
        statements: () => this.getSprint64PreChartingStatements(),
      },
      {
        id: 'sprint65_smart_inbox',
        label: 'Sprint 65 - Smart Inbox AI Triage',
        version: '2026.03.18',
        description: 'inbox_messages, inbox_triage_results tables for AI-prioritised clinical inbox',
        statements: () => this.getSprint65SmartInboxStatements(),
      },
      {
        id: 'sprint66_tb_module',
        label: 'Sprint 66 - Tuberculosis Module',
        version: '2026.03.18',
        description: 'tb_cases, tb_treatment_records, tb_contact_traces, tb_sputum_results, tb_drug_susceptibility tables',
        statements: () => this.getSprint66TbModuleStatements(),
      },
      {
        id: 'sprint67_pediatrics_module',
        label: 'Sprint 67 - Pediatrics Module',
        version: '2026.03.18',
        description: 'growth_measurements, developmental_milestones, neonatal_assessments, vaccination_records, pediatric_consultations tables',
        statements: () => this.getSprint67PediatricsModuleStatements(),
      },
      {
        id: 'sprint68_mental_health_module',
        label: 'Sprint 68 - Mental Health Module',
        version: '2026.03.18',
        description: 'mental_health_assessments, mental_health_treatment_plans, mental_health_sessions, crisis_incidents, substance_use_records tables',
        statements: () => this.getSprint68MentalHealthModuleStatements(),
      },
      {
        id: 'sprint69_malaria_module',
        label: 'Sprint 69 - Malaria Module',
        version: '2026.03.18',
        description: 'malaria_cases, malaria_rdt_results, malaria_treatments tables',
        statements: () => this.getSprint69MalariaModuleStatements(),
      },
      {
        id: 'sprint70_geriatrics_module',
        label: 'Sprint 70 - Geriatrics Module',
        version: '2026.03.18',
        description: 'geriatric_assessments, fall_risk_assessments, cognitive_assessments, frailty_scores, polypharmacy_reviews tables',
        statements: () => this.getSprint70GeriatricsModuleStatements(),
      },
      {
        id: 'sprint71_neurology_module',
        label: 'Sprint 71 - Neurology Module',
        version: '2026.03.18',
        description: 'seizure_records, stroke_assessments, headache_diaries, cognitive_screenings tables',
        statements: () => this.getSprint71NeurologyModuleStatements(),
      },
      {
        id: 'sprint72_pulmonology_module',
        label: 'Sprint 72 - Pulmonology Module',
        version: '2026.03.18',
        description: 'spirometry_results, copd_assessments, asthma_records, peak_flow_diaries, oxygen_therapy_records tables',
        statements: () => this.getSprint72PulmonologyModuleStatements(),
      },
      {
        id: 'sprint73_nephrology_module',
        label: 'Sprint 73 - Nephrology Module',
        version: '2026.03.18',
        description: 'ckd_assessments, dialysis_records, fluid_balance_records, renal_biopsies, transplant_records tables',
        statements: () => this.getSprint73NephrologyModuleStatements(),
      },
      {
        id: 'sprint74_dermatology_module',
        label: 'Sprint 74 - Dermatology Module',
        version: '2026.03.18',
        description: 'skin_lesions, wound_assessments, burn_assessments, dermatology_notes tables',
        statements: () => this.getSprint74DermatologyModuleStatements(),
      },
      {
        id: 'sprint75_palliative_care_module',
        label: 'Sprint 75 - Palliative Care Module',
        version: '2026.03.19',
        description: 'palliative_assessments, symptom_burden_scores (ESAS), goals_of_care, advance_directive_records, palliative_medication_reviews tables',
        statements: () => this.getSprint75PalliativeCareModuleStatements(),
      },
      {
        id: 'sprint76_nutrition_module',
        label: 'Sprint 76 - Nutrition & Dietetics Module',
        version: '2026.03.19',
        description: 'nutritional_screenings, nutritional_assessments, dietary_prescriptions, nutrition_monitoring tables',
        statements: () => this.getSprint76NutritionModuleStatements(),
      },
      {
        id: 'sprint77_icu_module',
        label: 'Sprint 77 - ICU / Critical Care Module',
        version: '2026.03.19',
        description: 'icu_admissions, sofa_scores, ventilator_settings, sedation_records, central_line_records, vasopressor_records tables',
        statements: () => this.getSprint77IcuModuleStatements(),
      },
      {
        id: 'sprint78_sdoh_module',
        label: 'Sprint 78 - SDOH Module (Structured Social Determinants)',
        version: '2026.03.19',
        description: 'community_resources, sdoh_referrals, sdoh_screening_logs tables',
        statements: () => this.getSprint78SdohModuleStatements(),
      },
      {
        id: 'sprint79_ntd_regional',
        label: 'Sprint 79 - Neglected Tropical Diseases + Regional Module',
        version: '2026.03.19',
        description: 'ntd_cases, cholera_cases, typhoid_cases, regional_disease_reports tables',
        statements: () => this.getSprint79NtdRegionalStatements(),
      },
      {
        id: 'sprint80_advanced_hiv_pmtct_pepfar',
        label: 'Sprint 80 - Advanced HIV Module (PMTCT + PEPFAR MER)',
        version: '2026.03.19',
        description: 'pmtct_enrollments, pmtct_infants, pepfar_mer_indicators, art_cohorts tables',
        statements: () => this.getSprint80AdvancedHivPmtctPepfarStatements(),
      },
      {
        id: 'sprint81_auto_coding',
        label: 'Sprint 81 - Auto ICD-10/CPT Coding NLP Pipeline',
        version: '2026.03.19',
        description: 'auto_coding_suggestions table',
        statements: () => this.getSprint81AutoCodingStatements(),
      },
      {
        id: 'sprint82_pharmacogenomics',
        label: 'Sprint 82 - Pharmacogenomics Module',
        version: '2026.03.19',
        description: 'pgx_profiles, pgx_alerts tables',
        statements: () => this.getSprint82PharmacogenomicsStatements(),
      },
      {
        id: 'sprint83_antibiogram',
        label: 'Sprint 83 - Local Antibiogram AI',
        version: '2026.03.19',
        description: 'antibiogram_entries, antibiogram_summaries, culture_sensitivity_results tables',
        statements: () => this.getSprint83AntibiogramStatements(),
      },
      {
        id: 'sprint84_ai_explainability',
        label: 'Sprint 84 - AI Explainability Layer',
        version: '2026.03.19',
        description: 'ai_recommendation_audits table',
        statements: () => this.getSprint84AiExplainabilityStatements(),
      },
      {
        id: 'sprint86_smart_scheduling',
        label: 'Sprint 86 - Smart Scheduling AI',
        version: '2026.03.19',
        description: 'scheduling_ai_predictions table; ALTER appointments add ai_recommended_duration, no_show_risk, overbooking_slot',
        statements: () => this.getSprint86SmartSchedulingStatements(),
      },
      {
        id: 'sprint87_smart_defaults',
        label: 'Sprint 87 - Smart Defaults + Dynamic Forms',
        version: '2026.03.19',
        description: 'form_intelligence_configs table',
        statements: () => this.getSprint87SmartDefaultsStatements(),
      },
      {
        id: 'sprint88_formulary_optimization',
        label: 'Sprint 88 - Formulary Optimization AI',
        version: '2026.03.19',
        description: 'formulary_ai_suggestions table; ALTER drugs add generic_name_canonical, formulary_tier, etc.',
        statements: () => this.getSprint88FormularyOptimizationStatements(),
      },
      {
        id: 'sprint89_predictive_risk',
        label: 'Sprint 89 - Predictive Deterioration & Readmission',
        version: '2026.03.19',
        description: 'deterioration_predictions, readmission_predictions tables',
        statements: () => this.getSprint89PredictiveRiskStatements(),
      },
      {
        id: 'sprint90_federated_learning',
        label: 'Sprint 90 - Federated Learning Infrastructure',
        version: '2026.03.19',
        description: 'fl_rounds, fl_participation_logs tables',
        statements: () => this.getSprint90FederatedLearningStatements(),
      },
      {
        id: 'sprint91_himis_reporting',
        label: 'Sprint 91 - MOHCC HIMIS + OpenMRS Migration',
        version: '2026.03.19',
        description: 'mohcc_report_submissions, openmrs_migration_logs tables',
        statements: () => this.getSprint91HimisReportingStatements(),
      },
      {
        id: 'sprint92_fhir_inbound',
        label: 'Sprint 92 - Bidirectional FHIR Inbound',
        version: '2026.03.19',
        description: 'fhir_ingestion_logs table',
        statements: () => this.getSprint92FhirInboundStatements(),
      },
      {
        id: 'sprint93_multilingual_education',
        label: 'Sprint 93 - Multilingual Patient Education',
        version: '2026.03.19',
        description: 'patient_education_materials table',
        statements: () => this.getSprint93MultilingualEducationStatements(),
      },
      {
        id: 'sprint94_offline_sync',
        label: 'Sprint 94 - Offline Sync PWA',
        version: '2026.03.19',
        description: 'sync_queue_logs table',
        statements: () => this.getSprint94OfflineSyncStatements(),
      },
      {
        id: 'sprint95_iot_wearables',
        label: 'Sprint 95 - IoT / Wearables Integration',
        version: '2026.03.19',
        description: 'iot_device_registrations, iot_data_ingestions tables',
        statements: () => this.getSprint95IotWearablesStatements(),
      },
      {
        id: 'sprint96_radiology_ai',
        label: 'Sprint 96 - Radiology AI (DICOM + CXR/Retinal/Derm)',
        version: '2026.03.19',
        description: 'dicom_studies, radiology_ai_findings tables',
        statements: () => this.getSprint96RadiologyAiStatements(),
      },
      {
        id: 'sprint97_alert_delivery',
        label: 'Sprint 97 - Real-Time Critical Alert Delivery',
        version: '2026.03.19',
        description: 'clinical_alert_deliveries table; ALTER users add fcm_token, on_call, phone',
        statements: () => this.getSprint97AlertDeliveryStatements(),
      },
      {
        id: 'sprint98_model_monitoring',
        label: 'Sprint 98 - AI Model Drift & Fairness Monitoring',
        version: '2026.03.19',
        description: 'model_performance_metrics, model_fairness_reports tables',
        statements: () => this.getSprint98ModelMonitoringStatements(),
      },
      {
        id: 'sprint99_patient_ai',
        label: 'Sprint 99 - Patient Conversational AI',
        version: '2026.03.19',
        description: 'symptom_checker_sessions, adherence_chat_logs tables',
        statements: () => this.getSprint99PatientAiStatements(),
      },
      {
        id: 'sprint100_trial_matching',
        label: 'Sprint 100 - Clinical Trial Matching',
        version: '2026.03.19',
        description: 'trial_matches table with UNIQUE(patient_id, nct_id)',
        statements: () => this.getSprint100TrialMatchingStatements(),
      },
      {
        id: 'sprint101_supply_chain_ai',
        label: 'Sprint 101 - Supply Chain AI / Stockout Prediction',
        version: '2026.03.19',
        description: 'pharmacy_inventory, stockout_predictions, procurement_alerts tables',
        statements: () => this.getSprint101SupplyChainAiStatements(),
      },
      {
        id: 'sprint103_model_registry',
        label: 'Sprint 103 - Autonomous Learning Loop / Model Registry',
        version: '2026.03.24.3',
        description: 'governed model_registry, model_cards, model_shadow_evaluations, model_promotion_reviews, and outcome_learning_jobs',
        statements: () => this.getSprint103ModelRegistryStatements(),
      },
      {
        id: 'sprint104_telemedicine_video',
        label: 'Sprint 104 - Telemedicine Real Video Provider (Daily.co)',
        version: '2026.03.19',
        description: 'recording_download_url + recording_fetched_at columns on telemedicine_consultations',
        statements: () => this.getSprint104TelemedicineVideoStatements(),
      },
      {
        id: 'sprint106_telemedicine_fixes',
        label: 'Sprint 106 - Telemedicine Notifications + State Machine',
        version: '2026.03.19',
        description: 'reminder_sent_at + updated_by on telemedicine_consultations; reminder index',
        statements: () => this.getSprint106TelemedicineFixesStatements(),
      },
      {
        id: 'sprint107_telemedicine_postvisit_bridge',
        label: 'Sprint 107 - Telemedicine ↔ PostVisit Bridge',
        version: '2026.03.19',
        description: 'recording_sha256 on post_visit_sessions; consultation_id index for bridge',
        statements: () => this.getSprint107TelemedicinePostvisitBridgeStatements(),
      },
      {
        id: 'sprint108_postvisit_decomposition',
        label: 'Sprint 108 - PostVisit Service Decomposition',
        version: '2026.03.19',
        description: 'Marker only — pure code refactor, no schema changes',
        statements: () => [],
      },
      {
        id: 'sprint109_notification_persistence',
        label: 'Sprint 109 - Persistent Notification System',
        version: '2026.03.21',
        description: 'nurse_tasks viewed_at/viewed_by + staff_notifications inbox table',
        statements: () => this.getSprint109NotificationPersistenceStatements(),
      },
      {
        id: 'sprint111_schema_cleanup',
        label: 'Sprint 111 - Entity/Test Unblock Schema Cleanup',
        version: '2026.03.24.1',
        description: 'Remove legacy dialysis_records.urrpercent column to match current entity contract',
        statements: () => this.getSprint111SchemaCleanupStatements(),
      },
      {
        id: 'sprint111_ai_audit_hardening',
        label: 'Sprint 111 - AI Audit Hardening',
        version: '2026.03.24.1',
        description: 'Provision tenant AI audit tables and immutable HIPAA audit extensions used by governed AI surfaces',
        statements: () => this.getSprint111AiAuditHardeningStatements(),
      },
      {
        id: 'sprint112_registration_intelligence',
        label: 'Sprint 112 - Registration Intelligence',
        version: '2026.03.24.1',
        description: 'patient_identity_matches, registration_document_extracts, intake_assessments, insurance_eligibility_checks',
        statements: () => this.getSprint112RegistrationIntelligenceStatements(),
      },
      {
        id: 'sprint111_encounter_orchestration',
        label: 'Sprint 111 Encounter Copilot Orchestration',
        version: '2026.03.26.3',
        description: 'encounter_copilot_sessions, treatment_pathway_instances, order_appropriateness_reviews, and result_followup_tasks for longitudinal encounter orchestration',
        statements: () => this.getSprint111EncounterOrchestrationStatements(),
      },
      {
        id: 'sprint111_pharmacy_intelligence',
        label: 'Sprint 111 Pharmacy Intelligence',
        version: '2026.03.26.3',
        description: 'medication reconciliation reviews, substitution recommendations, inventory forecasts, dispensing anomalies, and dispense-plan acknowledgment persistence for AI-first pharmacy workflows',
        statements: () => this.getSprint111PharmacyIntelligenceStatements(),
      },
      {
        id: 'sprint111_radiology_intelligence',
        label: 'Sprint 111 Radiology Intelligence',
        version: '2026.03.26.3',
        description: 'Persisted imaging order AI reviews, radiology report drafts, discrepancy reviews, and incidental follow-up workflow guidance',
        statements: () => this.getSprint111RadiologyIntelligenceStatements(),
      },
      {
        id: 'sprint111_patient_ai_unification',
        label: 'Sprint 111 Patient AI Unification',
        version: '2026.03.26.1',
        description: 'patient AI session state, patient AI escalations, and patient follow-up orchestration persistence',
        statements: () => this.getSprint111PatientAiUnificationStatements(),
      },
      {
        id: 'sprint111_ai_release_gates',
        label: 'Sprint 111 AI Evaluation and Release Gates',
        version: '2026.03.26.1',
        description: 'Persisted AI evaluation runs and release gate results for MOAS-12 evidence-based release control',
        statements: () => this.getSprint111AiReleaseGateStatements(),
      },
      {
        id: 'sprint111_entity_completeness',
        label: 'Sprint 111 Entity Completeness Backfill',
        version: '2026.04.04.1',
        description: 'Adds all 32 TypeORM entity tables that were missing from provisioning: advance_care_planning, appointment_resources, appointment_resource_bookings, appointment_templates, care_gap_detections, cdss_decision_log, clinical_pathways, crisis_events, ed_visits, falls_assessments, inbox_items, malaria_contact_tracing, malaria_surveillance_reports, malaria_tests, mental_health_screenings, neonatal_records, neurology_examinations, nurse_tasks, patient_sdoh, pediatric_profiles, pressure_injury_assessments, psychiatric_encounters, psychotropic_medications, safe_plans, school_health_records, tb_patients, tb_diagnoses, tb_dot_records, tb_drug_susceptibilities, tb_outcomes, tb_treatment_episodes, tb_contact_investigations',
        statements: () => this.getSprint111EntityCompletenessStatements(),
      },
      {
        id: 'sprint112_p0_safety',
        label: 'Sprint 112 - P0 Safety Foundations',
        version: '2026.04.04.1',
        description: 'consent_type index + encryption_key_versions tracking + audit enhancements',
        statements: () => this.getSprint112P0SafetyStatements(),
      },
      {
        id: 'sprint112_feedback_persistence',
        label: 'Sprint 112 - CDSS Feedback Persistence',
        version: '2026.03.27.2',
        description: 'cdss_feedback_batches and cdss_feedback_entries tables — durable outcome feedback replacing SQLite /tmp storage',
        statements: () => this.getSprint112FeedbackPersistenceStatements(),
      },
      {
        id: 'sprint113_ui_completeness',
        label: 'Sprint 113 - UI Completeness Schema',
        version: '2026.03.27.3',
        description: 'New columns for UI completeness: deterioration ML fields on early warning scores, followup resolution tracking',
        statements: () => this.getSprint113UiCompletenessStatements(),
      },
      {
        id: 'sprint126_scheduler_schema_fixes',
        label: 'Sprint 126 - Scheduler schema fixes for oncology/cardiology background jobs',
        version: '2026.04.01.1',
        description: 'Adds missing columns needed by background scheduler services: oncology_adverse_events (severity_grade, snomed_concept_id, status, escalated_at), oncology_regimens (cycle_length_days, current_cycle, last_cycle_date, next_cycle_date), cardiology_encounters (follow_up_required, follow_up_date)',
        statements: () => this.getSprint126SchedulerSchemaFixStatements(),
      },
      {
        id: 'sprint117_radiology_viewer',
        label: 'Sprint 117 - Radiology DICOM Viewer with AI Heatmap',
        version: '2026.03.31.2',
        description: 'heatmap_regions on radiology_report_drafts, dicom_series table',
        statements: () => this.getSprint117RadiologyViewerStatements(),
      },
      {
        id: 'sprint117_registration_ai',
        label: 'Sprint 117 - Registration AI (Phonetic Match, OCR, SDOH)',
        version: '2026.03.31.1',
        description: 'registration_ai_sessions, insurance_ocr_results, pg_trgm + trigram indexes on patients',
        statements: () => this.getSprint117RegistrationAiStatements(),
      },
      {
        id: 'sprint116_risk_stratification_self_learning',
        label: 'Sprint 116 - Risk Stratification + Self-Learning Loop',
        version: '2026.03.30.1',
        description: 'patient_risk_tiers, risk_stratification_batches, model_deployments, ai_ops_metrics',
        statements: () => this.getSprint116RiskStratSelfLearningStatements(),
      },
      {
        id: 'sprint115_denial_prediction',
        label: 'Sprint 115 - Denial Prediction ML + Financial AI',
        version: '2026.03.29.1',
        description: 'claim_risk_scores, claim_appeals, financial_hardship_referrals, pdmp_checks',
        statements: () => this.getSprint115DenialPredictionStatements(),
      },
      {
        id: 'sprint114_clinical_rag',
        label: 'Sprint 114 - Clinical RAG Knowledge Base',
        version: '2026.03.28.1',
        description: 'clinical_knowledge_documents + clinical_knowledge_chunks (pgvector) for grounded RAG',
        statements: () => this.getSprint114ClinicalRagStatements(),
      },
      {
        id: 'sprint127_proactive_ai',
        label: 'Sprint 127-132 - Proactive AI Nervous System',
        version: '2026.04.03.1',
        description: 'patient_ai_snapshots, proactive_alerts, patient_risk_scores tables',
        statements: () => this.getSprint127ProactiveAiStatements(),
      },
      {
        id: 'sprint127_proactive_ai_column_hardening',
        label: 'Sprint 127 - Proactive AI Column Hardening',
        version: '2026.04.03.1',
        description: 'Adds missing columns to proactive_alerts and patient_risk_scores; renames acknowledged_by → acknowledged_by_id',
        statements: () => this.getSprint127ProactiveAiColumnHardeningStatements(),
      },
      {
        id: 'epi-registry',
        label: 'EPI / Immunization Registry',
        version: TENANT_EPI_REGISTRY_BUNDLE_VERSION,
        description: 'S129 — EPI schedule engine, vaccination records, vaccine lots, cold chain logging, AEFI reports, and DHIS2 Tracker sync log',
        statements: () => TENANT_EPI_REGISTRY_STATEMENTS,
      },
      {
        id: 'outbreak-surveillance',
        label: 'Outbreak Surveillance + Notifiable Disease Alerts',
        version: TENANT_OUTBREAK_SURVEILLANCE_BUNDLE_VERSION,
        description: 'S130 — Configurable notifiable disease alerts, MOH threshold alerts, SORMAS case notification, and contact tracing',
        statements: () => TENANT_OUTBREAK_SURVEILLANCE_STATEMENTS,
      },
      {
        id: 'mobile-money',
        label: 'Mobile Money Payment Gateway',
        version: TENANT_MOBILE_MONEY_BUNDLE_VERSION,
        description: 'S131 — Mobile money payment gateway integration (M-Pesa, MTN, EcoCash, Airtel, Flutterwave)',
        statements: () => TENANT_MOBILE_MONEY_STATEMENTS,
      },
      {
        id: 'chw-module',
        label: 'Community Health Worker Module',
        version: TENANT_CHW_MODULE_BUNDLE_VERSION,
        description: 'S132 — Households, CHW visits, CHW tasks, daily tallies, offline sync, and supervision dashboards',
        statements: TENANT_CHW_MODULE_STATEMENTS,
      },
      {
        id: 'nutrition-cmam',
        label: 'SAM / CMAM Nutrition Programs',
        version: TENANT_NUTRITION_CMAM_BUNDLE_VERSION,
        description: 'S133 — CMAM nutrition assessments, RUTF dispensing, therapeutic feeding, and CMAM reporting registers',
        statements: TENANT_NUTRITION_CMAM_STATEMENTS,
      },
      {
        id: 'nhif-cbhi',
        label: 'NHIF/CBHI Capitation Billing',
        version: TENANT_NHIF_CBHI_BUNDLE_VERSION,
        description: 'NHIF schemes, scheme members, claims, capitation payments',
        statements: TENANT_NHIF_CBHI_STATEMENTS,
      },
      {
        id: 'sa-national-interop',
        label: 'SA National System Interoperability',
        version: TENANT_SA_NATIONAL_INTEROP_BUNDLE_VERSION,
        description: 'S135 — NHLS HL7 lab results, TIER.net ART exports, ETR.net TB notifications',
        statements: TENANT_SA_NATIONAL_INTEROP_STATEMENTS,
      },
      {
        id: 'dhis2-tracker-datim',
        label: 'DHIS2 Tracker TEI + DATIM MER 2.x',
        version: TENANT_DHIS2_TRACKER_DATIM_BUNDLE_VERSION,
        description:
          'S136 — DHIS2 Tracker individual TEI enrollment, program stage events, DATIM MER indicator mappings and submissions',
        statements: TENANT_DHIS2_TRACKER_DATIM_STATEMENTS,
      },
      {
        id: 'openmrs-mfl',
        label: 'OpenMRS FHIR Adapter & Kenya MFL Sync',
        version: TENANT_OPENMRS_MFL_BUNDLE_VERSION,
        description: 'S138 — OpenMRS FHIR patient links and sync logs, plus Kenya MFL facility sync',
        statements: TENANT_OPENMRS_MFL_STATEMENTS,
      },
      {
        id: 'sprint157_disa_smartcare_integration',
        label: 'Sprint 157 — DISA VL Integration + SmartCare Zambia',
        version: TENANT_DISA_SMARTCARE_BUNDLE_VERSION,
        description: 'Creates disa_sync_log, smartcare_patient_links, cross_border_patient_flags tables',
        statements: TENANT_DISA_SMARTCARE_STATEMENTS,
      },
      {
        id: 'sprint158_low_bandwidth_lite',
        label: 'Sprint 158 — Low-Bandwidth Lite Mode + USSD Clinical Entry',
        version: TENANT_LOW_BANDWIDTH_BUNDLE_VERSION,
        description: 'Creates offline_sync_queue, ussd_clinical_entries tables',
        statements: TENANT_LOW_BANDWIDTH_STATEMENTS,
      },
      {
        id: 'sprint159_ubuntu_cultural_health',
        label: 'Sprint 159 — Ubuntu Cultural Health Model',
        version: TENANT_UBUNTU_BUNDLE_VERSION,
        description: 'Creates social_determinants, family_council_consents, ubuntu_wellbeing_assessments tables',
        statements: TENANT_UBUNTU_STATEMENTS,
      },
      {
        id: 'sprint160_uhc_sdg_indicators',
        label: 'Sprint 160 — UHC Service Coverage Index + WHO SDG Health Indicators',
        version: TENANT_UHC_SDG_BUNDLE_VERSION,
        description: 'Creates uhc_indicator_snapshots, sdg_indicator_targets tables; seeds 11 SDG targets',
        statements: TENANT_UHC_SDG_STATEMENTS,
      },
      {
        id: 'sprint161_ncid_national_client_id',
        label: 'Sprint 161 - NCID National Client Identification',
        version: TENANT_NCID_BUNDLE_VERSION,
        description:
          'ncid_registrations, ncid_duplicate_flags, ncid_programme_linkages — national ID registry and deduplication',
        statements: TENANT_NCID_STATEMENTS,
      },
      {
        id: 'sprint139_crvs',
        label: 'CRVS Birth/Death Notification',
        version: TENANT_CRVS_BUNDLE_VERSION,
        description: 'S139 — birth notifications, death certificates, MDSR notifications',
        statements: TENANT_CRVS_STATEMENTS,
      },
      {
        id: 'at-messaging',
        label: "Africa's Talking Messaging",
        version: TENANT_AT_MESSAGING_BUNDLE_VERSION,
        description: "S137 — Africa's Talking SMS/USSD, WhatsApp health notifications, message logs, USSD session state",
        statements: TENANT_AT_MESSAGING_STATEMENTS,
      },
      {
        id: 'sprint140_ntd_malaria',
        label: 'NTD Programs + Malaria Clinical Depth',
        version: TENANT_NTD_MALARIA_BUNDLE_VERSION,
        description: 'S140 — NTD assessments, MDA campaigns, structured malaria episodes',
        statements: TENANT_NTD_MALARIA_STATEMENTS,
      },
      {
        id: 'sprint141_mental_health_mhgap',
        label: 'mhGAP Mental Health + SADC Language Tools',
        version: TENANT_MENTAL_HEALTH_MHGAP_BUNDLE_VERSION,
        description: 'S141 — mhGAP care plans, community follow-ups, multilingual screening tools, and screening columns',
        statements: TENANT_MENTAL_HEALTH_MHGAP_STATEMENTS,
      },
      {
        id: 'sprint142_cervical_family_planning',
        label: 'Cervical Cancer Screening + Family Planning',
        version: TENANT_CERVICAL_FP_BUNDLE_VERSION,
        description: 'S142 — cervical screening/treatment and family planning enrollment/follow-up',
        statements: TENANT_CERVICAL_FP_STATEMENTS,
      },
      {
        id: 'sprint143_htn_ncd_register',
        label: 'Hypertension Register + NCD Treatment Reviews',
        version: TENANT_HTN_NCD_BUNDLE_VERSION,
        description: 'S143 — HTN register, serial BP readings, WHO PEN step therapy treatment reviews',
        statements: TENANT_HTN_NCD_STATEMENTS,
      },
      {
        id: 'sprint143b_traditional_medicine_hdi',
        label: 'Traditional Medicine Documentation + Herb-Drug Interaction Alerts',
        version: TENANT_TM_HDI_BUNDLE_VERSION,
        description: 'S143b — TM remedy records, HDI alerts, TM toxicity events',
        statements: TENANT_TM_HDI_STATEMENTS,
      },
      {
        id: 'sprint144_scd_haemoglobinopathy',
        label: 'Sickle Cell Disease Register + Complication Protocol',
        version: TENANT_SCD_BUNDLE_VERSION,
        description: 'S144 — SCD register, crisis events, treatment records, complication screenings',
        statements: TENANT_SCD_STATEMENTS,
      },
      {
        id: 'sprint145_epilepsy_ncd_register',
        label: 'Epilepsy NCD Register + AED Therapy Protocol',
        version: TENANT_EPILEPSY_BUNDLE_VERSION,
        description: 'S145 — epilepsy register, AED therapy records, AED toxicity events',
        statements: TENANT_EPILEPSY_STATEMENTS,
      },
      {
        id: 'sprint146_one_health_pactr',
        label: 'One Health / Zoonotic Pathways + PACTR Trial Integration',
        version: TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION,
        description: 'S146 — animal exposures, one health reports, rabies PEP, PACTR trial matching',
        statements: TENANT_ONE_HEALTH_PACTR_STATEMENTS,
      },
      {
        id: 'sprint126_reporting_completeness',
        label: 'Reporting Completeness — lab turnaround, HIPAA disclosures, tax, analytics templates',
        version: TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION,
        description: 'S126 — seeds 5 default analytics templates; fixes compliance reporting gaps',
        statements: TENANT_REPORTING_COMPLETENESS_STATEMENTS,
      },
      {
        id: 'sprint147_maternal_mortality_emonc',
        label: 'Maternal Mortality Audit & EmONC Signal Function Tracking',
        version: TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION,
        description: 'S147 — maternal_deaths, maternal_death_reviews, emonc_signals tables',
        statements: TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS,
      },
      {
        id: 'sprint148_ncd_complications',
        label: 'NCD Complication Registry — Diabetic Foot, Retinopathy, CKD Staging',
        version: TENANT_NCD_COMPLICATIONS_BUNDLE_VERSION,
        description: 'S148 — diabetic_foot_assessments, retinopathy_screenings, ckd_staging_records, ncd_complication_summaries',
        statements: TENANT_NCD_COMPLICATIONS_STATEMENTS,
      },
      {
        id: 'sprint150_vhf_case_management',
        label: 'Sprint 150 — Mpox / Ebola / VHF Case Management',
        version: TENANT_VHF_CASE_MANAGEMENT_BUNDLE_VERSION,
        description: 'Creates vhf_cases, vhf_contacts, mpox_lesion_assessments tables',
        statements: TENANT_VHF_CASE_MANAGEMENT_STATEMENTS,
      },
      {
        id: 'tenant_entity_alignment',
        label: 'Tenant Entity Alignment',
        version: TENANT_ENTITY_ALIGNMENT_BUNDLE_VERSION,
        description: 'Generated backfill bundle that aligns tenant provisioning with the current tenant entity table/column contract',
        statements: () => TENANT_ENTITY_ALIGNMENT_STATEMENTS,
      },
      {
        id: 'tenant_entity_shadow_cleanup',
        label: 'Tenant Entity Shadow Cleanup',
        version: TENANT_ENTITY_SHADOW_CLEANUP_BUNDLE_VERSION,
        description: 'Backfills canonical snake_case columns from legacy camelCase shadow columns and drops the shadows',
        statements: () => TENANT_ENTITY_SHADOW_CLEANUP_STATEMENTS,
      },
      {
        id: 'tenant_entity_structure_alignment',
        label: 'Tenant Entity Structure Alignment',
        version: TENANT_ENTITY_STRUCTURE_ALIGNMENT_BUNDLE_VERSION,
        description: 'Generated structural backfill bundle for entity-declared indexes, unique constraints, and foreign keys',
        statements: () => TENANT_ENTITY_STRUCTURE_ALIGNMENT_STATEMENTS,
      },
      {
        id: 'sprint151_plague_yfm_protocols',
        label: 'Sprint 151 — Plague, Yellow Fever, Meningitis Protocols',
        version: TENANT_PLAGUE_YFM_BUNDLE_VERSION,
        description: 'Creates plague_cases, yellow_fever_cases, meningitis_cases tables',
        statements: TENANT_PLAGUE_YFM_STATEMENTS,
      },
      {
        id: 'sprint153_ntd_clinical_depth',
        label: 'Sprint 153 — NTD Depth: Leprosy MDT, Onchocerciasis, Filariasis',
        version: TENANT_NTD_DEPTH_BUNDLE_VERSION,
        description: 'Creates leprosy_cases, onchocerciasis_cases, filariasis_cases tables',
        statements: TENANT_NTD_DEPTH_STATEMENTS,
      },
      {
        id: 'sprint156_tba_birth_registration',
        label: 'Sprint 156 — TBA Module + Rural Birth Registration',
        version: TENANT_TBA_BIRTH_BUNDLE_VERSION,
        description: 'Creates tba_register, home_birth_records tables',
        statements: TENANT_TBA_BIRTH_STATEMENTS,
      },
      {
        id: 'sprint152_sormas_ihr_pipeline',
        label: 'Sprint 152 — SORMAS Bridge + IHR Alert Pipeline',
        version: TENANT_SORMAS_IHR_BUNDLE_VERSION,
        description: 'Creates sormas_sync_log, ihr_notifications, ebs_signals tables',
        statements: TENANT_SORMAS_IHR_STATEMENTS,
      },
      {
        id: 'sprint154_cbhi_deep_module',
        label: 'Sprint 154 — CBHI Deep Module (Contributions, Exemptions, Claims AI)',
        version: TENANT_CBHI_DEEP_BUNDLE_VERSION,
        description: 'Creates cbhi_households, cbhi_household_members, cbhi_contributions, cbhi_claims tables',
        statements: TENANT_CBHI_DEEP_STATEMENTS,
      },
      {
        id: 'sprint155_language_pack_i18n',
        label: 'Sprint 155 — Language Pack i18n (user_language_preferences)',
        version: TENANT_LANGUAGE_PREFS_BUNDLE_VERSION,
        description: 'Creates user_language_preferences table; seeds default English row',
        statements: TENANT_LANGUAGE_PREFS_STATEMENTS,
      },
      {
        id: 'sprint165_push_tokens',
        label: 'Sprint 165 — FCM Push Notification Tokens',
        version: '2026.04.21.1',
        description: 'push_tokens table for per-user FCM/Expo token storage with upsert-safe unique constraint on (user_id, token)',
        statements: () => this.getSprint165PushTokensStatements(),
      },
      {
        id: 'pro_clinician_feedback',
        label: 'PRO Clinician Feedback',
        version: '2026.05.08.1',
        description: 'Stores clinician-to-patient messages tied to PRO questionnaire responses; adds acknowledged_by/at and notes columns to pro_alerts',
        statements: () => [
          `CREATE TABLE IF NOT EXISTS pro_clinician_feedback (
             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
             patient_questionnaire_id UUID NOT NULL,
             clinician_id TEXT,
             message TEXT NOT NULL,
             is_read BOOLEAN NOT NULL DEFAULT FALSE,
             created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )`,
          `CREATE INDEX IF NOT EXISTS idx_pro_feedback_questionnaire
             ON pro_clinician_feedback(patient_questionnaire_id)`,
          `ALTER TABLE pro_alerts
             ADD COLUMN IF NOT EXISTS acknowledged_by TEXT`,
          `ALTER TABLE pro_alerts
             ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ`,
          `ALTER TABLE pro_alerts
             ADD COLUMN IF NOT EXISTS notes TEXT`,
        ],
      },
    ];
  }

  private getSprint165PushTokensStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS push_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        token       TEXT NOT NULL,
        platform    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, token)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id)`,
    ];
  }

  public getCoreSchemaStatements(): string[] {
    return [...this.getClinicSchema()];
  }

  private getSprint111EncounterOrchestrationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS encounter_copilot_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
        medical_record_id UUID NULL REFERENCES medical_records(id) ON DELETE SET NULL,
        ambient_session_id UUID NULL REFERENCES ambient_sessions(id) ON DELETE SET NULL,
        generated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        encounter_type VARCHAR(50) NULL,
        specialty VARCHAR(100) NULL,
        chief_complaint TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'generated',
        summary TEXT NULL,
        active_problems JSONB NOT NULL DEFAULT '[]'::jsonb,
        missing_context JSONB NOT NULL DEFAULT '[]'::jsonb,
        suggested_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
        likely_care_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
        contraindication_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        pathway_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
        specialty_contributors JSONB NOT NULL DEFAULT '[]'::jsonb,
        encounter_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence_score NUMERIC(5,2) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_encounter_copilot_sessions_patient_created ON encounter_copilot_sessions(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_encounter_copilot_sessions_appointment ON encounter_copilot_sessions(appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_encounter_copilot_sessions_status ON encounter_copilot_sessions(status)`,
      `CREATE TABLE IF NOT EXISTS treatment_pathway_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_copilot_session_id UUID NOT NULL REFERENCES encounter_copilot_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
        pathway_id UUID NULL REFERENCES clinical_pathways(id) ON DELETE SET NULL,
        pathway_code VARCHAR(100) NULL,
        pathway_name VARCHAR(255) NOT NULL,
        specialty VARCHAR(100) NULL,
        condition VARCHAR(255) NULL,
        recommendation_rank INTEGER NOT NULL DEFAULT 1,
        recommendation_reason TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'recommended',
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_treatment_pathway_instances_session_rank ON treatment_pathway_instances(encounter_copilot_session_id, recommendation_rank)`,
      `CREATE INDEX IF NOT EXISTS idx_treatment_pathway_instances_patient_status ON treatment_pathway_instances(patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_treatment_pathway_instances_pathway ON treatment_pathway_instances(pathway_id)`,
      `CREATE TABLE IF NOT EXISTS order_appropriateness_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_copilot_session_id UUID NOT NULL REFERENCES encounter_copilot_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
        reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        proposed_order_type VARCHAR(50) NULL,
        proposed_order_name VARCHAR(255) NOT NULL,
        appropriateness_status VARCHAR(40) NOT NULL DEFAULT 'needs_context',
        confidence_score NUMERIC(5,2) NULL,
        proposed_order JSONB NOT NULL DEFAULT '{}'::jsonb,
        supporting_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
        blocking_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommended_alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
        rationale TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_order_appropriateness_reviews_session ON order_appropriateness_reviews(encounter_copilot_session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_order_appropriateness_reviews_patient_status ON order_appropriateness_reviews(patient_id, appropriateness_status)`,
      `CREATE TABLE IF NOT EXISTS result_followup_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_copilot_session_id UUID NOT NULL REFERENCES encounter_copilot_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID NULL REFERENCES appointments(id) ON DELETE SET NULL,
        generated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        source_type VARCHAR(50) NOT NULL,
        source_reference_id UUID NULL,
        source_status VARCHAR(30) NULL,
        task_type VARCHAR(50) NOT NULL,
        task_title VARCHAR(255) NOT NULL,
        task_summary TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'high',
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        recommended_action TEXT NULL,
        due_at TIMESTAMPTZ NULL,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_result_followup_tasks_session_status ON result_followup_tasks(encounter_copilot_session_id, status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_result_followup_tasks_patient_priority ON result_followup_tasks(patient_id, priority, due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_result_followup_tasks_source ON result_followup_tasks(source_type, source_reference_id)`,
    ];
  }

  private getSprint112RegistrationIntelligenceStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_identity_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(40) NOT NULL DEFAULT 'registration_intake',
        source_reference VARCHAR(100) NULL,
        subject_patient_id UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
        candidate_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
        match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        match_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
        match_status VARCHAR(30) NOT NULL DEFAULT 'suggested',
        reviewed_by UUID NULL,
        reviewed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_identity_matches_source_reference ON patient_identity_matches(source_reference)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_identity_matches_subject_patient_id ON patient_identity_matches(subject_patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_identity_matches_candidate_patient_id ON patient_identity_matches(candidate_patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_identity_matches_status ON patient_identity_matches(match_status)`,
      `CREATE TABLE IF NOT EXISTS registration_document_extracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
        document_type VARCHAR(50) NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        file_sha256 VARCHAR(64) NULL,
        extraction_status VARCHAR(30) NOT NULL DEFAULT 'processed',
        ocr_engine VARCHAR(60) NULL,
        ocr_confidence DECIMAL(5,4) NULL,
        extracted_text TEXT NULL,
        structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_registration_document_extracts_patient_id ON registration_document_extracts(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_registration_document_extracts_document_type ON registration_document_extracts(document_type)`,
      `CREATE INDEX IF NOT EXISTS idx_registration_document_extracts_file_sha256 ON registration_document_extracts(file_sha256)`,
      `CREATE TABLE IF NOT EXISTS intake_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
        assessment_type VARCHAR(40) NOT NULL DEFAULT 'registration',
        completeness_score DECIMAL(5,2) NOT NULL DEFAULT 0,
        missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        suspected_duplicate_count INTEGER NOT NULL DEFAULT 0,
        duplicate_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
        coverage_risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
        coverage_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        consent_ready BOOLEAN NOT NULL DEFAULT false,
        consent_missing_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        front_desk_summary TEXT NULL,
        nurse_summary TEXT NULL,
        clinician_summary TEXT NULL,
        document_extract_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_intake_assessments_patient_id ON intake_assessments(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_intake_assessments_type ON intake_assessments(assessment_type)`,
      `CREATE TABLE IF NOT EXISTS insurance_eligibility_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
        provider_name VARCHAR(150) NULL,
        member_number VARCHAR(100) NULL,
        plan_name VARCHAR(120) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'information_required',
        confidence DECIMAL(5,4) NULL,
        coverage_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_insurance_eligibility_checks_patient_id ON insurance_eligibility_checks(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_insurance_eligibility_checks_status ON insurance_eligibility_checks(status)`,
    ];
  }

  private getSprint111PharmacyIntelligenceStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS medication_reconciliation_ai_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        encounter_id UUID NULL,
        generated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        review_status VARCHAR(30) NOT NULL DEFAULT 'generated',
        reported_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
        current_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
        history_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        discrepancy_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
        duplicate_therapy_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
        adherence_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
        safety_alerts JSONB NOT NULL DEFAULT '{}'::jsonb,
        recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        counseling_material_id UUID NULL,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_med_recon_ai_reviews_patient_created ON medication_reconciliation_ai_reviews(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_med_recon_ai_reviews_status ON medication_reconciliation_ai_reviews(review_status, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS pharmacy_substitution_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NULL REFERENCES medication_reconciliation_ai_reviews(id) ON DELETE SET NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        prescription_id UUID NULL,
        source_medication_name VARCHAR(255) NOT NULL,
        source_generic_name VARCHAR(255) NULL,
        generic_alternative VARCHAR(255) NULL,
        recommendation_status VARCHAR(30) NOT NULL DEFAULT 'recommended',
        recommendation_type VARCHAR(40) NOT NULL DEFAULT 'formulary_substitution',
        cost_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        rationale TEXT NULL,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_sub_recommendations_review ON pharmacy_substitution_recommendations(review_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_sub_recommendations_patient_status ON pharmacy_substitution_recommendations(patient_id, recommendation_status)`,
      `CREATE TABLE IF NOT EXISTS pharmacy_inventory_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
        generated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        forecast_horizon_days INTEGER NOT NULL DEFAULT 30,
        lookback_days INTEGER NOT NULL DEFAULT 30,
        forecast_status VARCHAR(30) NOT NULL DEFAULT 'generated',
        inventory_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        usage_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        projected_demand NUMERIC(12,2) NOT NULL DEFAULT 0,
        average_daily_usage NUMERIC(12,4) NOT NULL DEFAULT 0,
        predicted_stockout_date TIMESTAMPTZ NULL,
        days_until_stockout NUMERIC(10,2) NULL,
        shortage_risk VARCHAR(20) NOT NULL DEFAULT 'low',
        recommended_order_quantity INTEGER NOT NULL DEFAULT 0,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_forecasts_inventory_horizon ON pharmacy_inventory_forecasts(inventory_id, forecast_horizon_days, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_forecasts_shortage_risk ON pharmacy_inventory_forecasts(shortage_risk, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS pharmacy_dispensing_anomalies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dispensing_id UUID NOT NULL REFERENCES pharmacy_dispensings(id) ON DELETE CASCADE,
        dispensing_item_id UUID NOT NULL REFERENCES pharmacy_dispensing_items(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        prescription_id UUID NULL,
        inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
        reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        anomaly_type VARCHAR(40) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        anomaly_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        medication_name VARCHAR(255) NOT NULL,
        rationale TEXT NOT NULL,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        reviewed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_dispensing_anomalies_item_type ON pharmacy_dispensing_anomalies(dispensing_item_id, anomaly_type)`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_anomalies_patient_status ON pharmacy_dispensing_anomalies(patient_id, status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_anomalies_severity ON pharmacy_dispensing_anomalies(severity, anomaly_score DESC)`,
      `ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS ai_review_acknowledged_at TIMESTAMPTZ NULL`,
      `ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS ai_review_acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS ai_review_summary JSONB NOT NULL DEFAULT '{}'::jsonb`,
    ];
  }

  private getSprint111RadiologyIntelligenceStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS imaging_order_ai_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        study_type_id UUID NOT NULL REFERENCES imaging_study_types(id) ON DELETE CASCADE,
        reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        review_status VARCHAR(30) NOT NULL DEFAULT 'generated',
        appropriateness_status VARCHAR(40) NOT NULL DEFAULT 'needs_context',
        protocol_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        supporting_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
        blocking_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommended_alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
        guideline_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        rationale TEXT NOT NULL,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_imaging_order_ai_reviews_order_created ON imaging_order_ai_reviews(imaging_order_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_imaging_order_ai_reviews_patient_status ON imaging_order_ai_reviews(patient_id, appropriateness_status)`,
      `CREATE TABLE IF NOT EXISTS radiology_report_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE,
        imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        ai_finding_id UUID NULL REFERENCES radiology_ai_findings(id) ON DELETE SET NULL,
        generated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        draft_status VARCHAR(30) NOT NULL DEFAULT 'generated',
        draft_findings TEXT NOT NULL,
        draft_impression TEXT NOT NULL,
        draft_recommendations TEXT NULL,
        structured_draft JSONB NOT NULL DEFAULT '{}'::jsonb,
        supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        guideline_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        linked_report_id UUID NULL REFERENCES imaging_reports(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_radiology_report_drafts_study_created ON radiology_report_drafts(imaging_study_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_radiology_report_drafts_report_status ON radiology_report_drafts(linked_report_id, draft_status)`,
      `CREATE TABLE IF NOT EXISTS radiology_discrepancy_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE,
        imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE,
        imaging_report_id UUID NOT NULL REFERENCES imaging_reports(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        ai_finding_id UUID NULL REFERENCES radiology_ai_findings(id) ON DELETE SET NULL,
        reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ NULL,
        review_status VARCHAR(30) NOT NULL DEFAULT 'generated',
        resolution_notes TEXT NULL,
        discrepancy_status VARCHAR(40) NOT NULL DEFAULT 'no_ai_comparison',
        ai_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        report_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        discrepancy_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        rationale TEXT NOT NULL,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE radiology_discrepancy_reviews ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL`,
      `ALTER TABLE radiology_discrepancy_reviews ADD COLUMN IF NOT EXISTS resolution_notes TEXT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_radiology_discrepancy_reviews_report_created ON radiology_discrepancy_reviews(imaging_report_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_radiology_discrepancy_reviews_study_status ON radiology_discrepancy_reviews(imaging_study_id, discrepancy_status)`,
      `CREATE TABLE IF NOT EXISTS incidental_finding_followups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE,
        imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE,
        imaging_report_id UUID NOT NULL REFERENCES imaging_reports(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        completed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMPTZ NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        followup_type VARCHAR(50) NOT NULL DEFAULT 'incidental_finding_followup',
        severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
        title VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        recommended_action TEXT NULL,
        due_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        resolution_notes TEXT NULL,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        governance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE incidental_finding_followups ADD COLUMN IF NOT EXISTS acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE incidental_finding_followups ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ NULL`,
      `ALTER TABLE incidental_finding_followups ADD COLUMN IF NOT EXISTS resolution_notes TEXT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_incidental_followups_report_status ON incidental_finding_followups(imaging_report_id, status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_incidental_followups_patient_due ON incidental_finding_followups(patient_id, status, due_at)`,
    ];
  }

  private getSprint111PatientAiUnificationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_ai_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        session_type VARCHAR(40) NOT NULL,
        source_session_id VARCHAR(100) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        latest_message TEXT NULL,
        latest_reply TEXT NULL,
        latest_intent VARCHAR(80) NULL,
        triage_level VARCHAR(30) NULL,
        urgency VARCHAR(20) NOT NULL DEFAULT 'routine',
        guidance_summary TEXT NULL,
        requires_clinician_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
        urgent_signal BOOLEAN NOT NULL DEFAULT FALSE,
        abstained BOOLEAN NOT NULL DEFAULT FALSE,
        abstain_reason TEXT NULL,
        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_sessions_patient_created ON patient_ai_sessions(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_sessions_type_status ON patient_ai_sessions(session_type, status)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_sessions_source_session ON patient_ai_sessions(source_session_id)`,
      `CREATE TABLE IF NOT EXISTS patient_ai_escalations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        patient_ai_session_id UUID NULL REFERENCES patient_ai_sessions(id) ON DELETE SET NULL,
        source_type VARCHAR(40) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        route_target VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        trigger_summary TEXT NOT NULL,
        recommended_action TEXT NULL,
        resolution_notes TEXT NULL,
        resolved_at TIMESTAMPTZ NULL,
        resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_escalations_patient_status ON patient_ai_escalations(patient_id, status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_escalations_session_status ON patient_ai_escalations(patient_ai_session_id, status)`,
      `CREATE TABLE IF NOT EXISTS patient_followup_orchestrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        patient_ai_session_id UUID NULL REFERENCES patient_ai_sessions(id) ON DELETE SET NULL,
        trigger_type VARCHAR(50) NOT NULL,
        risk_level VARCHAR(20) NOT NULL DEFAULT 'routine',
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        reminder_state VARCHAR(30) NOT NULL DEFAULT 'pending',
        next_action TEXT NOT NULL,
        unresolved_question TEXT NULL,
        nonadherence_flag BOOLEAN NOT NULL DEFAULT FALSE,
        missed_followup_flag BOOLEAN NOT NULL DEFAULT FALSE,
        route_back_target VARCHAR(30) NULL,
        due_at TIMESTAMPTZ NULL,
        last_touched_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_followup_orchestrations_patient_status ON patient_followup_orchestrations(patient_id, status, due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_followup_orchestrations_session_status ON patient_followup_orchestrations(patient_ai_session_id, status)`,
    ];
  }

  private getSprint111AiReleaseGateStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS ai_eval_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ai_surface VARCHAR(80) NOT NULL,
        model_name VARCHAR(80) NULL,
        case_set_name VARCHAR(120) NOT NULL,
        dataset_version VARCHAR(80) NOT NULL,
        run_status VARCHAR(30) NOT NULL DEFAULT 'passed',
        total_cases INTEGER NOT NULL DEFAULT 0,
        report_path TEXT NULL,
        retrieval_recall_at_k FLOAT NULL,
        retrieval_hit_rate_at_k FLOAT NULL,
        citation_support_rate FLOAT NULL,
        abstain_correctness FLOAT NULL,
        unsafe_overconfident_output_rate FLOAT NULL,
        summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        gate_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        executed_by VARCHAR(120) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_surface_created ON ai_eval_runs(ai_surface, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_status ON ai_eval_runs(run_status, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS ai_release_gate_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        eval_run_id UUID NULL REFERENCES ai_eval_runs(id) ON DELETE CASCADE,
        ai_surface VARCHAR(80) NOT NULL,
        gate_name VARCHAR(80) NOT NULL,
        gate_status VARCHAR(30) NOT NULL DEFAULT 'passed',
        comparator VARCHAR(12) NULL,
        observed_value FLOAT NULL,
        threshold_value FLOAT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_release_gate_results_surface_gate ON ai_release_gate_results(ai_surface, gate_name, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_release_gate_results_status ON ai_release_gate_results(gate_status, created_at DESC)`,
    ];
  }

  private getDhis2SyncFoundationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS dhis2_patient_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE UNIQUE,
        dhis2_tei_id VARCHAR(64) NOT NULL,
        org_unit_id VARCHAR(64),
        tenant_identifier VARCHAR(128),
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_dhis2_patient_mappings_patient_id ON dhis2_patient_mappings(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_dhis2_patient_mappings_tei_id ON dhis2_patient_mappings(dhis2_tei_id)`,
      `CREATE TABLE IF NOT EXISTS dhis2_sync_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        dhis2_id VARCHAR(64),
        action VARCHAR(20) NOT NULL CHECK (action IN ('create','update','upsert','skip','error','run_now')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('success','error','skipped')),
        error_message TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `ALTER TABLE dhis2_sync_log DROP CONSTRAINT IF EXISTS dhis2_sync_log_action_check`,
      `ALTER TABLE dhis2_sync_log ADD CONSTRAINT dhis2_sync_log_action_check CHECK (action IN ('create','update','upsert','skip','error','run_now'))`,
      `CREATE INDEX IF NOT EXISTS idx_dhis2_sync_log_entity_type ON dhis2_sync_log(entity_type)`,
      `CREATE INDEX IF NOT EXISTS idx_dhis2_sync_log_status ON dhis2_sync_log(status)`,
      `CREATE INDEX IF NOT EXISTS idx_dhis2_sync_log_synced_at ON dhis2_sync_log(synced_at DESC)`,
    ];
  }

  private getSprintH1PracticeManagementStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS fee_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        payer_type VARCHAR(50) CHECK (payer_type IN ('self_pay','medical_aid','insurance','government','other')),
        payer_name VARCHAR(255),
        effective_date DATE NOT NULL,
        end_date DATE,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS fee_schedule_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fee_schedule_id UUID NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
        cpt_code VARCHAR(10) NOT NULL,
        description VARCHAR(500),
        charge_amount DECIMAL(12,2) NOT NULL,
        allowed_amount DECIMAL(12,2),
        modifier VARCHAR(10),
        effective_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fsi_schedule ON fee_schedule_items(fee_schedule_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fsi_cpt ON fee_schedule_items(cpt_code)`,
      `CREATE TABLE IF NOT EXISTS superbill_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        specialty VARCHAR(100),
        sections JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS insurance_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        appointment_id UUID REFERENCES appointments(id),
        payer_name VARCHAR(255),
        policy_number VARCHAR(100),
        group_number VARCHAR(100),
        verification_status VARCHAR(30) DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','denied','expired','not_found')),
        coverage_details JSONB DEFAULT '{}'::jsonb,
        copay_amount DECIMAL(10,2),
        deductible_remaining DECIMAL(10,2),
        verified_at TIMESTAMP WITH TIME ZONE,
        verified_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_iv_patient ON insurance_verifications(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_iv_appointment ON insurance_verifications(appointment_id)`,
    ];
  }

  private getSprintH2PriorAuthorizationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS prior_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        payer_name VARCHAR(255),
        authorization_type VARCHAR(50) CHECK (authorization_type IN ('medication','procedure','imaging','referral','dme','other')),
        service_description TEXT NOT NULL,
        cpt_code VARCHAR(10),
        icd10_code VARCHAR(10),
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','submitted','pending','approved','denied','expired','appeal')),
        submitted_at TIMESTAMP WITH TIME ZONE,
        decision_at TIMESTAMP WITH TIME ZONE,
        authorization_number VARCHAR(100),
        authorized_units INTEGER,
        authorized_from DATE,
        authorized_to DATE,
        denial_reason TEXT,
        appeal_deadline DATE,
        notes TEXT,
        requested_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pa_patient ON prior_authorizations(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pa_status ON prior_authorizations(status)`,
    ];
  }

  private getSprintH3PatientPortalStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_portal_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        bill_id UUID,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(30) CHECK (payment_method IN ('ecocash','onemoney','card','bank_transfer')),
        payment_reference VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
        paid_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS health_education_content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        category VARCHAR(100),
        content_type VARCHAR(30) DEFAULT 'article' CHECK (content_type IN ('article','video','infographic','faq')),
        body TEXT NOT NULL,
        language VARCHAR(10) DEFAULT 'en',
        tags JSONB DEFAULT '[]'::jsonb,
        is_published BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_hec_category ON health_education_content(category)`,
      `CREATE INDEX IF NOT EXISTS idx_hec_language ON health_education_content(language)`,
      `CREATE TABLE IF NOT EXISTS patient_family_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        proxy_name VARCHAR(255) NOT NULL,
        proxy_email VARCHAR(255) NOT NULL,
        proxy_phone VARCHAR(30),
        relationship VARCHAR(50),
        access_level VARCHAR(30) DEFAULT 'view_only' CHECK (access_level IN ('view_only','full','emergency_only')),
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pfa_patient ON patient_family_access(patient_id)`,
    ];
  }

  private getSprintH4RecallCampaignStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS notification_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        channel VARCHAR(20) DEFAULT 'sms' CHECK (channel IN ('sms','email')),
        message_template TEXT NOT NULL,
        target_type VARCHAR(50) DEFAULT 'manual' CHECK (target_type IN ('manual','recall_list','query')),
        target_ref_id UUID,
        criteria JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','completed','cancelled','failed')),
        scheduled_at TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS notification_campaign_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id),
        destination VARCHAR(255),
        status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','skipped')),
        message_id VARCHAR(100),
        error TEXT,
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ncr_campaign ON notification_campaign_recipients(campaign_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ncr_patient ON notification_campaign_recipients(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nc_status ON notification_campaigns(status)`,
    ];
  }

  private getSprint111FinancialIntelligenceStatements(): string[] {
    return [
      `ALTER TABLE IF EXISTS financial_payments
        ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(30) DEFAULT 'unmatched' CHECK (reconciliation_status IN ('unmatched','matched','needs_review','discrepancy','resolved'))`,
      `ALTER TABLE IF EXISTS financial_payments
        ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE IF EXISTS financial_payments
        ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES users(id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_payments_reconciliation_status ON financial_payments(reconciliation_status)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_payments_received_at ON financial_payments(received_at DESC)`,

      `CREATE TABLE IF NOT EXISTS payment_provider_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id VARCHAR(120) NOT NULL,
        bill_id UUID,
        provider_type VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        provider_status VARCHAR(80),
        reference VARCHAR(255),
        correlation_id VARCHAR(255),
        request_payload JSONB DEFAULT '{}'::jsonb,
        response_payload JSONB DEFAULT '{}'::jsonb,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_provider_events_transaction_id ON payment_provider_events(transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_provider_events_provider_type ON payment_provider_events(provider_type)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_provider_events_event_type ON payment_provider_events(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_provider_events_bill_id ON payment_provider_events(bill_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_provider_events_event_timestamp ON payment_provider_events(event_timestamp DESC)`,

      `CREATE TABLE IF NOT EXISTS payment_verification_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id VARCHAR(120) NOT NULL,
        provider_type VARCHAR(50),
        reference VARCHAR(255),
        outcome VARCHAR(80) NOT NULL,
        reason TEXT,
        response_payload JSONB DEFAULT '{}'::jsonb,
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_verification_attempts_transaction_id ON payment_verification_attempts(transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_verification_attempts_outcome ON payment_verification_attempts(outcome)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_verification_attempts_attempted_at ON payment_verification_attempts(attempted_at DESC)`,

      `CREATE TABLE IF NOT EXISTS claim_denial_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL,
        risk_score NUMERIC(5,2) NOT NULL,
        risk_level VARCHAR(30) NOT NULL,
        blockers_count INTEGER DEFAULT 0,
        warnings_count INTEGER DEFAULT 0,
        missing_documents_count INTEGER DEFAULT 0,
        drivers JSONB DEFAULT '[]'::jsonb,
        recommended_actions JSONB DEFAULT '[]'::jsonb,
        model_version VARCHAR(50) DEFAULT 'rules.v1',
        predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_claim_denial_predictions_claim_id ON claim_denial_predictions(claim_id)`,
      `CREATE INDEX IF NOT EXISTS idx_claim_denial_predictions_risk_level ON claim_denial_predictions(risk_level)`,
      `CREATE INDEX IF NOT EXISTS idx_claim_denial_predictions_predicted_at ON claim_denial_predictions(predicted_at DESC)`,

      `CREATE TABLE IF NOT EXISTS financial_clearance_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID,
        bill_id UUID,
        claim_id UUID,
        appointment_id UUID,
        eligibility_status VARCHAR(50) DEFAULT 'unknown',
        estimated_responsibility NUMERIC(10,2),
        payer_estimated_amount NUMERIC(10,2),
        authorization_required BOOLEAN DEFAULT false,
        authorization_status VARCHAR(50),
        blockers JSONB DEFAULT '[]'::jsonb,
        recommended_next_step TEXT,
        assessment_data JSONB DEFAULT '{}'::jsonb,
        assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_financial_clearance_assessments_patient_id ON financial_clearance_assessments(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_clearance_assessments_claim_id ON financial_clearance_assessments(claim_id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_clearance_assessments_eligibility_status ON financial_clearance_assessments(eligibility_status)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_clearance_assessments_assessed_at ON financial_clearance_assessments(assessed_at DESC)`,

      `CREATE TABLE IF NOT EXISTS prior_authorization_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL,
        patient_id UUID,
        bill_id UUID,
        appointment_id UUID,
        medical_aid_name VARCHAR(150) NOT NULL,
        member_number VARCHAR(100),
        request_type VARCHAR(60) DEFAULT 'consultation',
        requested_amount NUMERIC(10,2),
        diagnosis_summary TEXT,
        procedure_summary TEXT,
        justification TEXT,
        supporting_documents JSONB DEFAULT '[]'::jsonb,
        draft_data JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_prior_authorization_drafts_claim_id ON prior_authorization_drafts(claim_id)`,
      `CREATE INDEX IF NOT EXISTS idx_prior_authorization_drafts_patient_id ON prior_authorization_drafts(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_prior_authorization_drafts_status ON prior_authorization_drafts(status)`,

      `CREATE TABLE IF NOT EXISTS financial_quote_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
        patient_id UUID,
        bill_id UUID,
        appointment_id UUID,
        payer_type VARCHAR(30) DEFAULT 'self',
        quote_status VARCHAR(40) DEFAULT 'estimate_only',
        total_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
        estimated_payer_amount NUMERIC(12,2),
        estimated_patient_responsibility NUMERIC(12,2),
        copay_amount NUMERIC(10,2),
        deductible_remaining NUMERIC(10,2),
        quote_confidence VARCHAR(20) DEFAULT 'medium',
        blockers JSONB DEFAULT '[]'::jsonb,
        recommended_next_step TEXT,
        quote_data JSONB DEFAULT '{}'::jsonb,
        quoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_financial_quote_assessments_transaction_id ON financial_quote_assessments(transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_quote_assessments_patient_id ON financial_quote_assessments(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_quote_assessments_quote_status ON financial_quote_assessments(quote_status)`,
      `CREATE INDEX IF NOT EXISTS idx_financial_quote_assessments_quoted_at ON financial_quote_assessments(quoted_at DESC)`,

      `CREATE TABLE IF NOT EXISTS bank_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        statement_date DATE NOT NULL,
        entry_date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        reference VARCHAR(255),
        entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
        is_matched BOOLEAN DEFAULT false,
        matched_payment_id UUID,
        matched_at TIMESTAMP WITH TIME ZONE,
        matched_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bank_statements_date ON bank_statements(entry_date)`,
      `CREATE INDEX IF NOT EXISTS idx_bank_statements_matched ON bank_statements(is_matched)`,
      `CREATE INDEX IF NOT EXISTS idx_bank_statements_reference ON bank_statements(reference)`,

      `CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_entry_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
        payment_id UUID NOT NULL,
        match_confidence VARCHAR(20) DEFAULT 'manual',
        match_reason TEXT,
        matched_by UUID REFERENCES users(id),
        matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_bank_entry_id ON payment_reconciliations(bank_entry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_payment_id ON payment_reconciliations(payment_id)`,

      `CREATE TABLE IF NOT EXISTS payment_anomaly_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_entry_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
        payment_id UUID,
        anomaly_type VARCHAR(80) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        anomaly_score NUMERIC(5,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'open',
        fingerprint VARCHAR(255) NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        evidence JSONB DEFAULT '{}'::jsonb,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolution_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_anomaly_flags_status ON payment_anomaly_flags(status)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_anomaly_flags_severity ON payment_anomaly_flags(severity)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_anomaly_flags_bank_entry_id ON payment_anomaly_flags(bank_entry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_anomaly_flags_payment_id ON payment_anomaly_flags(payment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_anomaly_flags_detected_at ON payment_anomaly_flags(detected_at DESC)`,

      `DROP TRIGGER IF EXISTS update_payment_provider_events_updated_at ON payment_provider_events`,
      `CREATE TRIGGER update_payment_provider_events_updated_at BEFORE UPDATE ON payment_provider_events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_payment_verification_attempts_updated_at ON payment_verification_attempts`,
      `CREATE TRIGGER update_payment_verification_attempts_updated_at BEFORE UPDATE ON payment_verification_attempts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_claim_denial_predictions_updated_at ON claim_denial_predictions`,
      `CREATE TRIGGER update_claim_denial_predictions_updated_at BEFORE UPDATE ON claim_denial_predictions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_financial_clearance_assessments_updated_at ON financial_clearance_assessments`,
      `CREATE TRIGGER update_financial_clearance_assessments_updated_at BEFORE UPDATE ON financial_clearance_assessments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_prior_authorization_drafts_updated_at ON prior_authorization_drafts`,
      `CREATE TRIGGER update_prior_authorization_drafts_updated_at BEFORE UPDATE ON prior_authorization_drafts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_financial_quote_assessments_updated_at ON financial_quote_assessments`,
      `CREATE TRIGGER update_financial_quote_assessments_updated_at BEFORE UPDATE ON financial_quote_assessments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_bank_statements_updated_at ON bank_statements`,
      `CREATE TRIGGER update_bank_statements_updated_at BEFORE UPDATE ON bank_statements
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_payment_anomaly_flags_updated_at ON payment_anomaly_flags`,
      `CREATE TRIGGER update_payment_anomaly_flags_updated_at BEFORE UPDATE ON payment_anomaly_flags
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprintI1TravelVaccineStatements(): string[] {
    const upsert = (countryName: string, iso: string, region: string, required: any[], recommended: any[], malaria: any[], notes: string) =>
      `INSERT INTO travel_vaccine_destinations (country_name, iso_code, region, required_vaccines, recommended_vaccines, malaria_prophylaxis_zones, special_notes, last_updated)\n` +
      `VALUES (\n` +
      `  '${countryName.replace(/'/g, "''")}',\n` +
      `  '${iso}',\n` +
      `  '${region.replace(/'/g, "''")}',\n` +
      `  '${JSON.stringify(required).replace(/'/g, "''")}'::jsonb,\n` +
      `  '${JSON.stringify(recommended).replace(/'/g, "''")}'::jsonb,\n` +
      `  '${JSON.stringify(malaria).replace(/'/g, "''")}'::jsonb,\n` +
      `  '${notes.replace(/'/g, "''")}',\n` +
      `  CURRENT_DATE\n` +
      `)\n` +
      `ON CONFLICT (iso_code) DO UPDATE SET\n` +
      `  country_name = EXCLUDED.country_name,\n` +
      `  region = EXCLUDED.region,\n` +
      `  required_vaccines = EXCLUDED.required_vaccines,\n` +
      `  recommended_vaccines = EXCLUDED.recommended_vaccines,\n` +
      `  malaria_prophylaxis_zones = EXCLUDED.malaria_prophylaxis_zones,\n` +
      `  special_notes = EXCLUDED.special_notes,\n` +
      `  last_updated = EXCLUDED.last_updated`;

    const YF = { code: 'YF', name: 'Yellow fever' };
    const TYP = { code: 'TYP', name: 'Typhoid' };
    const RAB = { code: 'RAB', name: 'Rabies' };
    const CHO = { code: 'CHO', name: 'Cholera' };
    const JE = { code: 'JE', name: 'Japanese encephalitis' };
    const MEN = { code: 'MEN', name: 'Meningococcal' };
    const HEPA = { code: 'HEPA', name: 'Hepatitis A' };
    const HEPB = { code: 'HEPB', name: 'Hepatitis B' };
    const POL = { code: 'POL', name: 'Polio' };
    const MMR = { code: 'MMR', name: 'Measles/Mumps/Rubella' };
    const TDAP = { code: 'TDAP', name: 'Tdap/Tetanus' };
    const C19 = { code: 'COVID', name: 'COVID-19' };

    return [
      `CREATE TABLE IF NOT EXISTS travel_vaccine_destinations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        country_name VARCHAR(100) NOT NULL,
        iso_code VARCHAR(3) NOT NULL UNIQUE,
        region VARCHAR(100),
        required_vaccines JSONB DEFAULT '[]'::jsonb,
        recommended_vaccines JSONB DEFAULT '[]'::jsonb,
        malaria_prophylaxis_zones JSONB DEFAULT '[]'::jsonb,
        special_notes TEXT,
        last_updated DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tvd_iso ON travel_vaccine_destinations(iso_code)`,
      `CREATE TABLE IF NOT EXISTS vaccination_certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        certificate_number VARCHAR(50) NOT NULL UNIQUE,
        certificate_type VARCHAR(30) DEFAULT 'yellow_card' CHECK (certificate_type IN ('yellow_card','covid_card','general')),
        issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
        issued_by UUID REFERENCES users(id),
        issuing_center VARCHAR(255),
        immunization_ids JSONB DEFAULT '[]'::jsonb,
        pdf_storage_key VARCHAR(500),
        is_valid BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_vc_patient ON vaccination_certificates(patient_id)`,

      // Seed destination requirements (55 countries)
      upsert('Zimbabwe', 'ZWE', 'Africa', [], [YF, TYP, HEPA, HEPB, TDAP, POL, MMR, C19], [{ zone: 'low', name: 'Zimbabwe (selected areas)' }], 'Routine + travel vaccines recommended; malaria risk varies by region.'),
      upsert('South Africa', 'ZAF', 'Africa', [], [TYP, HEPA, TDAP, MMR, C19], [{ zone: 'limited', name: 'Limpopo/Mpumalanga/KZN (some areas)' }], 'Yellow fever certificate required if arriving from risk countries.'),
      upsert('Kenya', 'KEN', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Most regions below 2,500m' }], 'Yellow fever recommended/required; malaria widespread.'),
      upsert('Tanzania', 'TZA', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever often required for Zanzibar travel; malaria risk.'),
      upsert('Uganda', 'UGA', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required; malaria high risk.'),
      upsert('Ghana', 'GHA', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required for entry.'),
      upsert('Nigeria', 'NGA', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required for entry.'),
      upsert('Senegal', 'SEN', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'moderate', name: 'Some regions' }], 'Yellow fever required for entry.'),
      upsert('Ethiopia', 'ETH', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, TDAP, POL, MMR, C19], [{ zone: 'variable', name: 'Lowlands' }], 'Yellow fever recommended for some areas.'),
      upsert('Rwanda', 'RWA', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'low', name: 'Limited' }], 'Yellow fever required/recommended depending on travel route.'),
      upsert('Mozambique', 'MOZ', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'High malaria risk; YF certificate required if from risk countries.'),
      upsert('Angola', 'AGO', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required.'),
      upsert('Democratic Republic of the Congo', 'COD', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, CHO, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required; cholera outbreaks possible.'),
      upsert('Cameroon', 'CMR', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required; malaria risk.'),
      upsert('Cote d’Ivoire', 'CIV', 'Africa', [YF], [TYP, HEPA, HEPB, RAB, MEN, TDAP, POL, MMR, C19], [{ zone: 'high', name: 'Widespread' }], 'Yellow fever required.'),
      upsert('Brazil', 'BRA', 'South America', [], [YF, TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'variable', name: 'Amazon basin' }], 'Yellow fever recommended for many states.'),
      upsert('Peru', 'PER', 'South America', [], [YF, TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'variable', name: 'Amazon regions' }], 'Yellow fever recommended for Amazon travel.'),
      upsert('Colombia', 'COL', 'South America', [], [YF, TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'variable', name: 'Lowland areas' }], 'Yellow fever recommended for some areas.'),
      upsert('Ecuador', 'ECU', 'South America', [], [YF, TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'variable', name: 'Amazon regions' }], 'Yellow fever recommended for Amazon travel.'),
      upsert('Bolivia', 'BOL', 'South America', [], [YF, TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'variable', name: 'Lowlands' }], 'Yellow fever recommended for lowland travel.'),
      upsert('Argentina', 'ARG', 'South America', [], [YF, TYP, HEPA, TDAP, MMR, C19], [{ zone: 'low', name: 'Limited' }], 'Yellow fever recommended for Iguazú region travel.'),
      upsert('India', 'IND', 'South Asia', [], [TYP, HEPA, HEPB, RAB, CHO, JE, TDAP, POL, MMR, C19], [{ zone: 'variable', name: 'Widespread in season' }], 'Consider JE for rural/long stays; malaria varies by region.'),
      upsert('Nepal', 'NPL', 'South Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Lowlands (Terai)' }], 'Malaria limited to some lowland areas.'),
      upsert('Pakistan', 'PAK', 'South Asia', [], [TYP, HEPA, HEPB, RAB, POL, TDAP, MMR, C19], [{ zone: 'variable', name: 'Some regions' }], 'Polio booster may be required for some travelers.'),
      upsert('Bangladesh', 'BGD', 'South Asia', [], [TYP, HEPA, HEPB, RAB, CHO, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Some regions' }], 'Cholera outbreaks possible; consider cholera vaccine for high-risk travel.'),
      upsert('Sri Lanka', 'LKA', 'South Asia', [], [TYP, HEPA, HEPB, RAB, TDAP, MMR, C19], [{ zone: 'low', name: 'Limited' }], 'Malaria currently low/limited.'),
      upsert('Thailand', 'THA', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Border/rural areas' }], 'JE for rural/long stays; malaria limited to some areas.'),
      upsert('Vietnam', 'VNM', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Rural areas' }], 'JE for rural/long stays; malaria in some regions.'),
      upsert('Cambodia', 'KHM', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Rural areas' }], 'Malaria risk in some rural areas.'),
      upsert('Laos', 'LAO', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Rural areas' }], 'Malaria risk in rural areas.'),
      upsert('Indonesia', 'IDN', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Many islands' }], 'Malaria risk depends on island/region.'),
      upsert('Philippines', 'PHL', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'variable', name: 'Some provinces' }], 'Malaria in some rural provinces; JE for rural/long stays.'),
      upsert('Malaysia', 'MYS', 'Southeast Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'limited', name: 'Borneo (some areas)' }], 'Malaria mainly limited; JE for rural areas.'),
      upsert('Singapore', 'SGP', 'Southeast Asia', [], [TDAP, MMR, C19], [], 'Routine vaccines recommended.'),
      upsert('China', 'CHN', 'East Asia', [], [TYP, HEPA, HEPB, RAB, JE, TDAP, MMR, C19], [{ zone: 'limited', name: 'Some provinces' }], 'JE for rural/long stays in endemic areas.'),
      upsert('Japan', 'JPN', 'East Asia', [], [TDAP, MMR, C19], [], 'Routine vaccines recommended.'),
      upsert('South Korea', 'KOR', 'East Asia', [], [TDAP, MMR, C19], [], 'Routine vaccines recommended.'),
      upsert('United Arab Emirates', 'ARE', 'Middle East', [], [TDAP, MMR, C19], [], 'Routine vaccines recommended.'),
      upsert('Saudi Arabia', 'SAU', 'Middle East', [], [MEN, TDAP, MMR, C19], [], 'Meningococcal required for Hajj/Umrah.'),
      upsert('Egypt', 'EGY', 'Middle East', [], [TYP, HEPA, TDAP, MMR, C19], [{ zone: 'limited', name: 'Some areas' }], 'Malaria limited; routine + travel vaccines recommended.'),
      upsert('Turkey', 'TUR', 'Europe/West Asia', [], [TYP, HEPA, TDAP, MMR, C19], [], 'Routine + selected travel vaccines.'),
      upsert('France', 'FRA', 'Europe', [], [TDAP, MMR, C19], [], 'Routine vaccines.'),
      upsert('United Kingdom', 'GBR', 'Europe', [], [TDAP, MMR, C19], [], 'Routine vaccines.'),
      upsert('United States', 'USA', 'North America', [], [TDAP, MMR, C19], [], 'Routine vaccines.'),
      upsert('Mexico', 'MEX', 'North America', [], [TYP, HEPA, TDAP, MMR, C19], [{ zone: 'limited', name: 'Some regions' }], 'Typhoid recommended for some travelers.'),
      upsert('Haiti', 'HTI', 'Caribbean', [], [TYP, HEPA, CHO, TDAP, MMR, C19], [], 'Cholera outbreaks possible; consider cholera vaccine.'),
      upsert('Dominican Republic', 'DOM', 'Caribbean', [], [TYP, HEPA, TDAP, MMR, C19], [], 'Routine + typhoid for some travelers.'),
      upsert('Australia', 'AUS', 'Oceania', [], [TDAP, MMR, C19], [], 'Routine vaccines.'),
      upsert('New Zealand', 'NZL', 'Oceania', [], [TDAP, MMR, C19], [], 'Routine vaccines.'),
    ];
  }

  private getSprintI2MultiCurrencyMedicalAidStatements(): string[] {
    return [
      // Billing currency alignment
      `ALTER TABLE billing ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD'`,
      `CREATE INDEX IF NOT EXISTS idx_billing_currency ON billing(currency)`,

      // Supported currencies + exchange rates (clinic-managed)
      `CREATE TABLE IF NOT EXISTS supported_currencies (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS exchange_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        base_currency VARCHAR(10) NOT NULL REFERENCES supported_currencies(code),
        quote_currency VARCHAR(10) NOT NULL REFERENCES supported_currencies(code),
        rate NUMERIC(18,8) NOT NULL,
        effective_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        source VARCHAR(50) DEFAULT 'manual',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_unique ON exchange_rates(base_currency, quote_currency, effective_at)`,
      `CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(base_currency, quote_currency)`,
      `CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective ON exchange_rates(effective_at DESC)`,

      // Seed common currencies
      `INSERT INTO supported_currencies (code, name, symbol, is_active)
       VALUES
        ('USD','US Dollar','$',true),
        ('ZAR','South African Rand','R',true),
        ('ZIG','Zimbabwe Gold','ZiG',true)
       ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        is_active = EXCLUDED.is_active`,

      // Medical aid integration stubs
      `CREATE TABLE IF NOT EXISTS medical_aid_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(30) UNIQUE,
        is_active BOOLEAN DEFAULT true,
        config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_medical_aid_providers_active ON medical_aid_providers(is_active)`,
      `INSERT INTO medical_aid_providers (name, code, is_active)
       VALUES
        ('CIMAS','CIMAS',true),
        ('First Mutual','FIRST_MUTUAL',true),
        ('PSMAS','PSMAS',true)
       ON CONFLICT (name) DO UPDATE SET
        code = EXCLUDED.code,
        is_active = EXCLUDED.is_active`,

      `CREATE TABLE IF NOT EXISTS medical_aid_eligibility_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        provider_id UUID REFERENCES medical_aid_providers(id),
        member_number VARCHAR(100),
        policy_number VARCHAR(100),
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','eligible','ineligible','error')),
        request_payload JSONB DEFAULT '{}'::jsonb,
        response_payload JSONB DEFAULT '{}'::jsonb,
        checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checked_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ma_elig_patient ON medical_aid_eligibility_checks(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ma_elig_provider ON medical_aid_eligibility_checks(provider_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ma_elig_status ON medical_aid_eligibility_checks(status)`,

      `CREATE TABLE IF NOT EXISTS medical_aid_claim_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
        provider_id UUID REFERENCES medical_aid_providers(id),
        claim_number VARCHAR(100),
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','submitted','accepted','rejected','paid','error')),
        submission_format VARCHAR(50) DEFAULT 'stub',
        payload JSONB DEFAULT '{}'::jsonb,
        response JSONB DEFAULT '{}'::jsonb,
        submitted_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ma_claim_tx ON medical_aid_claim_submissions(transaction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ma_claim_provider ON medical_aid_claim_submissions(provider_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ma_claim_status ON medical_aid_claim_submissions(status)`,

      `CREATE TABLE IF NOT EXISTS medical_aid_remittances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID REFERENCES medical_aid_providers(id),
        remittance_reference VARCHAR(150),
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(30) DEFAULT 'received' CHECK (status IN ('received','processed','error')),
        payload JSONB DEFAULT '{}'::jsonb,
        processed_by UUID REFERENCES users(id),
        processed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ma_remit_provider ON medical_aid_remittances(provider_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ma_remit_status ON medical_aid_remittances(status)`,
    ];
  }

  private getSprintJ2EarlyWarningStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_early_warning_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        score_type VARCHAR(20) DEFAULT 'NEWS2' CHECK (score_type IN ('NEWS2', 'MEWS', 'PEWS')),
        total_score INTEGER NOT NULL,
        risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'low_medium', 'medium', 'high')),
        component_scores JSONB NOT NULL,
        vitals_id UUID,
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        alert_triggered BOOLEAN DEFAULT false,
        alert_acknowledged_by UUID REFERENCES users(id),
        alert_acknowledged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ews_patient ON patient_early_warning_scores(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ews_score ON patient_early_warning_scores(total_score DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ews_risk ON patient_early_warning_scores(risk_level)`,
    ];
  }

  private getSprint111VitalsOperationalStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_vital_baselines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        metric_name VARCHAR(50) NOT NULL,
        baseline_value NUMERIC(10,2) NOT NULL,
        lower_bound NUMERIC(10,2),
        upper_bound NUMERIC(10,2),
        sample_count INTEGER DEFAULT 0,
        baseline_window_days INTEGER DEFAULT 14,
        source VARCHAR(30) DEFAULT 'rolling_recent',
        last_vitals_id UUID REFERENCES vitals(id) ON DELETE SET NULL,
        last_recorded_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_vital_baselines_patient_metric ON patient_vital_baselines(patient_id, metric_name)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_vital_baselines_updated_at ON patient_vital_baselines(updated_at DESC)`,
      `CREATE TABLE IF NOT EXISTS clinical_escalation_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        early_warning_score_id UUID REFERENCES patient_early_warning_scores(id) ON DELETE SET NULL,
        nurse_task_id UUID REFERENCES nurse_tasks(id) ON DELETE SET NULL,
        source_module VARCHAR(50) DEFAULT 'early_warning',
        source_reference_id UUID,
        escalation_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'high',
        status VARCHAR(30) DEFAULT 'open',
        title VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        recommended_action TEXT,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        due_at TIMESTAMP WITH TIME ZONE,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        evidence JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_clinical_escalation_tasks_patient_status ON clinical_escalation_tasks(patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_clinical_escalation_tasks_ews ON clinical_escalation_tasks(early_warning_score_id)`,
      `CREATE INDEX IF NOT EXISTS idx_clinical_escalation_tasks_due_at ON clinical_escalation_tasks(due_at)`,
      `CREATE TABLE IF NOT EXISTS remote_monitoring_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        submitted_by_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        vitals_id UUID REFERENCES vitals(id) ON DELETE SET NULL,
        device_id UUID REFERENCES iot_device_registrations(id) ON DELETE SET NULL,
        device_type VARCHAR(50),
        source_type VARCHAR(30) DEFAULT 'self_report',
        source_name VARCHAR(100),
        source_vendor VARCHAR(100),
        source_model VARCHAR(120),
        event_type VARCHAR(50) DEFAULT 'vitals_submission',
        verification_status VARCHAR(30) DEFAULT 'self_reported',
        source_confidence NUMERIC(5,2),
        measurement_count INTEGER DEFAULT 0,
        payload JSONB DEFAULT '{}'::jsonb,
        evaluation_summary TEXT,
        alert_count INTEGER DEFAULT 0,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES iot_device_registrations(id) ON DELETE SET NULL`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS device_type VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_events_patient ON remote_monitoring_events(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_events_device ON remote_monitoring_events(device_id)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_events_source_type ON remote_monitoring_events(source_type)`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS source_vendor VARCHAR(100)`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS source_model VARCHAR(120)`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'self_reported'`,
      `ALTER TABLE remote_monitoring_events ADD COLUMN IF NOT EXISTS measurement_count INTEGER DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_events_verification_status ON remote_monitoring_events(verification_status)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_events_submitted_at ON remote_monitoring_events(submitted_at DESC)`,
      `CREATE TABLE IF NOT EXISTS remote_monitoring_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES remote_monitoring_events(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        vitals_id UUID REFERENCES vitals(id) ON DELETE SET NULL,
        linked_escalation_task_id UUID REFERENCES clinical_escalation_tasks(id) ON DELETE SET NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(30) DEFAULT 'open',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        evidence JSONB DEFAULT '{}'::jsonb,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_alerts_event ON remote_monitoring_alerts(event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_alerts_patient_status ON remote_monitoring_alerts(patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_remote_monitoring_alerts_severity ON remote_monitoring_alerts(severity)`,
    ];
  }

  private getGatewayConfigurationStatements(): string[] {
    return [
      // SMS Gateway Configurations
      `CREATE TABLE IF NOT EXISTS sms_gateway_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_type VARCHAR(50) NOT NULL,
        provider_name VARCHAR(100),
        api_url VARCHAR(500) NOT NULL,
        api_key VARCHAR(255),
        api_secret VARCHAR(255),
        sender_id VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sms_gateway_config_provider_type ON sms_gateway_configurations(provider_type)`,
      `CREATE INDEX IF NOT EXISTS idx_sms_gateway_config_is_active ON sms_gateway_configurations(is_active)`,

      // Payment Gateway Configurations
      `CREATE TABLE IF NOT EXISTS payment_gateway_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_type VARCHAR(50) NOT NULL,
        provider_name VARCHAR(100),
        api_url VARCHAR(500) NOT NULL,
        merchant_id VARCHAR(100),
        integration_key VARCHAR(255),
        api_key VARCHAR(255),
        api_secret VARCHAR(255),
        webhook_url VARCHAR(500),
        webhook_secret VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        is_test_mode BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_provider_type ON payment_gateway_configurations(provider_type)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_is_active ON payment_gateway_configurations(is_active)`,
    ];
  }

  private getPortalEnhancementStatements(): string[] {
    return [
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_registered_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_last_login TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_email_verified BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_email_verification_token VARCHAR(255)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_password_reset_token VARCHAR(255)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_password_reset_expires TIMESTAMP WITH TIME ZONE`,

      `CREATE TABLE IF NOT EXISTS patient_messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id VARCHAR NOT NULL,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
          sender_type VARCHAR(50) NOT NULL,
          sender_id UUID,
          recipient_type VARCHAR(50) NOT NULL,
          recipient_id UUID,
          subject VARCHAR(500),
          message TEXT NOT NULL,
          message_type VARCHAR(50) NOT NULL DEFAULT 'general',
          priority VARCHAR(20) NOT NULL DEFAULT 'low',
          read BOOLEAN NOT NULL DEFAULT false,
          read_at TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_tenant_id" ON "patient_messages" ("tenant_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_patient_id" ON "patient_messages" ("patient_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_sender" ON "patient_messages" ("sender_type", "sender_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_recipient" ON "patient_messages" ("recipient_type", "recipient_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_read" ON "patient_messages" ("patient_id", "read")`,
      `CREATE INDEX IF NOT EXISTS "IDX_patient_messages_created_at" ON "patient_messages" ("created_at")`
    ];
  }

  private getSprintL1ContinuousLearningStatements(): string[] {
    return [
      `ALTER TABLE appointment_no_show_predictions ADD COLUMN IF NOT EXISTS actual_outcome VARCHAR(20)`,
      `ALTER TABLE appointment_no_show_predictions ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMP WITH TIME ZONE`,
      `CREATE TABLE IF NOT EXISTS ml_model_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DOUBLE PRECISION NOT NULL,
        sample_size INTEGER NOT NULL DEFAULT 0,
        period_start TIMESTAMP WITH TIME ZONE,
        period_end TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ml_metrics_model ON ml_model_metrics(model_name)`,
      `CREATE INDEX IF NOT EXISTS idx_ml_metrics_period ON ml_model_metrics(period_start, period_end)`,
      `CREATE TABLE IF NOT EXISTS ml_training_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(100) NOT NULL,
        model_version VARCHAR(50) NOT NULL,
        training_data_hash VARCHAR(64),
        feature_names JSONB DEFAULT '[]'::jsonb,
        feature_weights JSONB DEFAULT '[]'::jsonb,
        feature_means JSONB DEFAULT '[]'::jsonb,
        feature_stds JSONB DEFAULT '[]'::jsonb,
        intercept DOUBLE PRECISION DEFAULT 0,
        performance_metrics JSONB DEFAULT '{}'::jsonb,
        training_sample_count INTEGER DEFAULT 0,
        trained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ml_snapshots_model ON ml_training_snapshots(model_name)`,
      `CREATE INDEX IF NOT EXISTS idx_ml_snapshots_active ON ml_training_snapshots(is_active)`,
      `CREATE TABLE IF NOT EXISTS ml_coding_corpus (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinical_text TEXT NOT NULL,
        accepted_icd_codes JSONB DEFAULT '[]'::jsonb,
        accepted_cpt_codes JSONB DEFAULT '[]'::jsonb,
        tfidf_vector JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ml_coding_corpus_created ON ml_coding_corpus(created_at)`,
    ];
  }

  private getMedicationRemindersSchemaStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS medication_reminders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
        medication_name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(100),
        reminder_time TIME NOT NULL,
        reminder_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
        start_date DATE NOT NULL,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        last_sent_at TIMESTAMP WITH TIME ZONE,
        next_reminder_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient_id ON medication_reminders(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_medication_reminders_active ON medication_reminders(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_medication_reminders_prescription ON medication_reminders(prescription_id)`,
    ];
  }

  private getMaternityCareTaskSchemaStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS maternity_care_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('anc_visit','delivery','postnatal_visit','risk_factor','manual')),
        source_record_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','actioned','closed')),
        priority VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (priority IN ('low','medium','high','critical')),
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        blocker_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        required_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        suggested_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
        rule_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
        task_context JSONB NOT NULL DEFAULT '{}'::jsonb,
        assigned_to UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        actioned_by UUID REFERENCES users(id),
        actioned_at TIMESTAMP WITH TIME ZONE,
        closed_by UUID REFERENCES users(id),
        closed_at TIMESTAMP WITH TIME ZONE,
        closed_reason TEXT,
        latest_note TEXT,
        last_event_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_enrollment_id ON maternity_care_tasks(maternity_enrollment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_patient_id ON maternity_care_tasks(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_status ON maternity_care_tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_priority ON maternity_care_tasks(priority)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_assigned_to ON maternity_care_tasks(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_source ON maternity_care_tasks(source_type, source_record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_care_tasks_last_event_at ON maternity_care_tasks(last_event_at DESC)`,
    ];
  }

  private getSprint46NurseCopilotSchemaStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS nurse_copilot_task_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id VARCHAR(120) NOT NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
        reason TEXT,
        context JSONB,
        source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
        completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, task_id)
      )`,
      `CREATE TABLE IF NOT EXISTS nurse_copilot_alert_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alert_id VARCHAR(120) NOT NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'acknowledged' CHECK (status IN ('acknowledged')),
        reason TEXT,
        context JSONB,
        source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
        acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, alert_id)
      )`,
      `CREATE TABLE IF NOT EXISTS nurse_handoff_workflow_state (
        patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'reviewed', 'shared')),
        finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
        finalized_at TIMESTAMP WITH TIME ZONE,
        finalized_summary_preview TEXT,
        finalize_reason TEXT,
        finalize_context JSONB,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewer_name VARCHAR(255),
        reviewer_role VARCHAR(100),
        review_reason TEXT,
        review_context JSONB,
        shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
        shared_at TIMESTAMP WITH TIME ZONE,
        share_channel VARCHAR(50),
        share_recipient VARCHAR(255),
        share_reason TEXT,
        share_context JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_user_status ON nurse_copilot_task_events(user_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_patient ON nurse_copilot_task_events(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_completed_at ON nurse_copilot_task_events(completed_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_user_status ON nurse_copilot_alert_events(user_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_patient ON nurse_copilot_alert_events(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_ack_at ON nurse_copilot_alert_events(acknowledged_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_status ON nurse_handoff_workflow_state(status)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_finalized_at ON nurse_handoff_workflow_state(finalized_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_shared_at ON nurse_handoff_workflow_state(shared_at DESC)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_nurse_copilot_task_events_updated_at ON nurse_copilot_task_events`,
      `CREATE TRIGGER update_nurse_copilot_task_events_updated_at
        BEFORE UPDATE ON nurse_copilot_task_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_nurse_copilot_alert_events_updated_at ON nurse_copilot_alert_events`,
      `CREATE TRIGGER update_nurse_copilot_alert_events_updated_at
        BEFORE UPDATE ON nurse_copilot_alert_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_nurse_handoff_workflow_state_updated_at ON nurse_handoff_workflow_state`,
      `CREATE TRIGGER update_nurse_handoff_workflow_state_updated_at
        BEFORE UPDATE ON nurse_handoff_workflow_state
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint47NurseCrossModuleWorkflowSchemaStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS nurse_cross_module_workflow_state (
        workflow_key VARCHAR(160) PRIMARY KEY,
        module VARCHAR(40) NOT NULL,
        item_type VARCHAR(80) NOT NULL,
        source_record_id VARCHAR(160),
        enrollment_id UUID,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed')),
        destination_role VARCHAR(80),
        destination_service VARCHAR(120),
        destination_specialty VARCHAR(160),
        destination_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        destination_facility_id UUID,
        destination_facility_name VARCHAR(255),
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        note TEXT,
        context JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_module_status ON nurse_cross_module_workflow_state(module, status)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_item_type ON nurse_cross_module_workflow_state(item_type)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_patient ON nurse_cross_module_workflow_state(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_enrollment ON nurse_cross_module_workflow_state(enrollment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_destination_role ON nurse_cross_module_workflow_state(destination_role)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_destination_user ON nurse_cross_module_workflow_state(destination_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_cross_module_workflow_completed_at ON nurse_cross_module_workflow_state(completed_at DESC)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_nurse_cross_module_workflow_state_updated_at ON nurse_cross_module_workflow_state`,
      `CREATE TRIGGER update_nurse_cross_module_workflow_state_updated_at
        BEFORE UPDATE ON nurse_cross_module_workflow_state
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint48PostVisitCompanionSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        consultation_id UUID REFERENCES telemedicine_consultations(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'captured'
          CHECK (status IN ('captured','processing','draft_ready','doctor_reviewed','published','closed')),
        source_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
          CHECK (source_type IN ('in_person','telemedicine','hybrid')),
        language VARCHAR(10) DEFAULT 'en',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMP WITH TIME ZONE,
        safety_level VARCHAR(20),
        risk_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_transcript_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        segment_order INTEGER NOT NULL,
        start_second DOUBLE PRECISION NOT NULL,
        end_second DOUBLE PRECISION NOT NULL,
        text TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        language VARCHAR(10),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_extracted_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        entity_type VARCHAR(60) NOT NULL,
        entity_value TEXT NOT NULL,
        normalized_value JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence DOUBLE PRECISION,
        source_start_second DOUBLE PRECISION,
        source_end_second DOUBLE PRECISION,
        source_origin VARCHAR(30) NOT NULL DEFAULT 'transcript',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_draft_artifacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_type VARCHAR(50) NOT NULL,
        artifact_status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (artifact_status IN ('draft','reviewed','published')),
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        confidence DOUBLE PRECISION,
        generated_by VARCHAR(80) NOT NULL DEFAULT 'post_visit_pipeline',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, artifact_type)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_patient_id ON post_visit_sessions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_doctor_id ON post_visit_sessions(doctor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_status ON post_visit_sessions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_started_at ON post_visit_sessions(started_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_segments_session ON post_visit_transcript_segments(session_id, segment_order)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_extracted_entities_session ON post_visit_extracted_entities(session_id, entity_type)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_draft_artifacts_session ON post_visit_draft_artifacts(session_id, artifact_type)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_post_visit_sessions_updated_at ON post_visit_sessions`,
      `CREATE TRIGGER update_post_visit_sessions_updated_at
        BEFORE UPDATE ON post_visit_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_transcript_segments_updated_at ON post_visit_transcript_segments`,
      `CREATE TRIGGER update_post_visit_transcript_segments_updated_at
        BEFORE UPDATE ON post_visit_transcript_segments
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_extracted_entities_updated_at ON post_visit_extracted_entities`,
      `CREATE TRIGGER update_post_visit_extracted_entities_updated_at
        BEFORE UPDATE ON post_visit_extracted_entities
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_draft_artifacts_updated_at ON post_visit_draft_artifacts`,
      `CREATE TRIGGER update_post_visit_draft_artifacts_updated_at
        BEFORE UPDATE ON post_visit_draft_artifacts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint49PostVisitReviewCitationSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_review_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_id UUID REFERENCES post_visit_draft_artifacts(id) ON DELETE SET NULL,
        artifact_type VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('accept','edit','reject')),
        review_reason TEXT,
        review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        before_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        after_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_review',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_rule_citations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_type VARCHAR(50) NOT NULL DEFAULT 'recommendation_bundle',
        recommendation_id VARCHAR(120),
        rule_id VARCHAR(120) NOT NULL,
        guideline_id VARCHAR(120) NOT NULL,
        citation_label VARCHAR(255) NOT NULL,
        citation_source VARCHAR(255) NOT NULL,
        citation_url TEXT,
        evidence_excerpt TEXT,
        confidence DOUBLE PRECISION,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_session ON post_visit_review_actions(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_artifact ON post_visit_review_actions(artifact_type, action)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_session ON post_visit_rule_citations(session_id, rule_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_guideline ON post_visit_rule_citations(guideline_id)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_post_visit_review_actions_updated_at ON post_visit_review_actions`,
      `CREATE TRIGGER update_post_visit_review_actions_updated_at
        BEFORE UPDATE ON post_visit_review_actions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_rule_citations_updated_at ON post_visit_rule_citations`,
      `CREATE TRIGGER update_post_visit_rule_citations_updated_at
        BEFORE UPDATE ON post_visit_rule_citations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint50PostVisitExecutionActionSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_action_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        recommendation_id VARCHAR(120) NOT NULL,
        action_key VARCHAR(160) NOT NULL,
        action_type VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','failed','skipped')),
        execution_note TEXT,
        result_resource_type VARCHAR(80),
        result_resource_id VARCHAR(120),
        result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message TEXT,
        executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_execute',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, recommendation_id, action_key)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_session ON post_visit_action_executions(session_id, recommendation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_status ON post_visit_action_executions(status, executed_at DESC)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_post_visit_action_executions_updated_at ON post_visit_action_executions`,
      `CREATE TRIGGER update_post_visit_action_executions_updated_at
        BEFORE UPDATE ON post_visit_action_executions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint51PostVisitCompanionEscalationSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_companion_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','closed')),
        message_count INTEGER NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP WITH TIME ZONE,
        last_patient_message_at TIMESTAMP WITH TIME ZONE,
        last_clinician_message_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, patient_id)
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_companion_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES post_visit_companion_threads(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL
          CHECK (sender_type IN ('patient','clinician','system')),
        sender_id UUID,
        message_type VARCHAR(30) NOT NULL DEFAULT 'question'
          CHECK (message_type IN ('question','answer','summary','checklist','alert','system')),
        message_text TEXT NOT NULL,
        grounded_context JSONB NOT NULL DEFAULT '{}'::jsonb,
        escalation_detected BOOLEAN NOT NULL DEFAULT FALSE,
        escalation_event_id UUID,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_escalation_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        thread_id UUID REFERENCES post_visit_companion_threads(id) ON DELETE SET NULL,
        message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open','acknowledged','resolved','dismissed')),
        severity VARCHAR(20) NOT NULL
          CHECK (severity IN ('low','moderate','high','critical')),
        route_target VARCHAR(20) NOT NULL
          CHECK (route_target IN ('emergency','doctor','nurse')),
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'symptom_keyword',
        trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        signal_text TEXT,
        detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        sla_due_at TIMESTAMP WITH TIME ZONE,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT,
        workflow_key VARCHAR(160),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS post_visit_companion_acknowledgements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        acknowledgement_type VARCHAR(60) NOT NULL
          CHECK (acknowledgement_type IN ('teach_back','medication_adherence','follow_up_commitment','warning_sign_understanding')),
        acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_session ON post_visit_companion_threads(session_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_patient ON post_visit_companion_threads(patient_id, last_message_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_session ON post_visit_companion_messages(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_thread ON post_visit_companion_messages(thread_id, created_at ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_patient ON post_visit_companion_messages(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_escalation ON post_visit_companion_messages(escalation_detected, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_session ON post_visit_escalation_events(session_id, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_status ON post_visit_escalation_events(status, severity, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_route ON post_visit_escalation_events(route_target, status, sla_due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_trigger ON post_visit_escalation_events(trigger_type, status, route_target, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient ON post_visit_escalation_events(patient_id, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_session ON post_visit_companion_acknowledgements(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_patient ON post_visit_companion_acknowledgements(patient_id, acknowledgement_type)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,
      `DROP TRIGGER IF EXISTS update_post_visit_companion_threads_updated_at ON post_visit_companion_threads`,
      `CREATE TRIGGER update_post_visit_companion_threads_updated_at
        BEFORE UPDATE ON post_visit_companion_threads
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_companion_messages_updated_at ON post_visit_companion_messages`,
      `CREATE TRIGGER update_post_visit_companion_messages_updated_at
        BEFORE UPDATE ON post_visit_companion_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_escalation_events_updated_at ON post_visit_escalation_events`,
      `CREATE TRIGGER update_post_visit_escalation_events_updated_at
        BEFORE UPDATE ON post_visit_escalation_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_companion_acknowledgements_updated_at ON post_visit_companion_acknowledgements`,
      `CREATE TRIGGER update_post_visit_companion_acknowledgements_updated_at
        BEFORE UPDATE ON post_visit_companion_acknowledgements
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint52PostVisitIntraVisitRoutingSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_intravisit_alert_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open','confirmed','dismissed')),
        alert_type VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL
          CHECK (severity IN ('moderate','high','critical')),
        route_target VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (route_target IN ('doctor','nurse','emergency')),
        assigned_role VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (assigned_role IN ('doctor','nurse','rapid_response')),
        assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_team VARCHAR(80),
        policy_version VARCHAR(20) NOT NULL DEFAULT 'c3.v1',
        routing_rationale TEXT,
        source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
        transcript_offset_seconds INTEGER,
        signal_text TEXT,
        alert_message TEXT NOT NULL,
        suggested_action TEXT,
        confidence DOUBLE PRECISION,
        trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        sla_due_at TIMESTAMP WITH TIME ZONE,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledgment_note TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS post_visit_intravisit_alert_events
        ADD COLUMN IF NOT EXISTS route_target VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (route_target IN ('doctor','nurse','emergency')),
        ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (assigned_role IN ('doctor','nurse','rapid_response')),
        ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(80),
        ADD COLUMN IF NOT EXISTS policy_version VARCHAR(20) NOT NULL DEFAULT 'c3.v1',
        ADD COLUMN IF NOT EXISTS routing_rationale TEXT,
        ADD COLUMN IF NOT EXISTS source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
        ADD COLUMN IF NOT EXISTS transcript_offset_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS signal_text TEXT,
        ADD COLUMN IF NOT EXISTS trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS acknowledgment_note TEXT,
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS resolution_note TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_session ON post_visit_intravisit_alert_events(session_id, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_status ON post_visit_intravisit_alert_events(status, severity, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_patient ON post_visit_intravisit_alert_events(patient_id, detected_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_route ON post_visit_intravisit_alert_events(route_target, assigned_role, status, sla_due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_ack ON post_visit_intravisit_alert_events(status, acknowledged_at, detected_at DESC)`,
      `DROP TRIGGER IF EXISTS update_post_visit_intravisit_alert_events_updated_at ON post_visit_intravisit_alert_events`,
      `CREATE TRIGGER update_post_visit_intravisit_alert_events_updated_at
        BEFORE UPDATE ON post_visit_intravisit_alert_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint53PostVisitBillingIntelligenceSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_billing_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        suggestion_key VARCHAR(120) NOT NULL,
        code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('cpt','icd10')),
        code VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        justification TEXT,
        documentation_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
        documentation_score INTEGER NOT NULL DEFAULT 0,
        documentation_status VARCHAR(20) NOT NULL DEFAULT 'insufficient'
          CHECK (documentation_status IN ('sufficient','partial','insufficient')),
        status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed','approved','rejected')),
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        approval_note TEXT,
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_billing_intelligence_v1',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, suggestion_key)
      )`,
      `ALTER TABLE IF EXISTS post_visit_billing_suggestions
        ADD COLUMN IF NOT EXISTS suggestion_key VARCHAR(120),
        ADD COLUMN IF NOT EXISTS code_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS code VARCHAR(20),
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS justification TEXT,
        ADD COLUMN IF NOT EXISTS documentation_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS documentation_score INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS documentation_status VARCHAR(20) NOT NULL DEFAULT 'insufficient'
          CHECK (documentation_status IN ('sufficient','partial','insufficient')),
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed','approved','rejected')),
        ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS approval_note TEXT,
        ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'post_visit_billing_intelligence_v1',
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE TABLE IF NOT EXISTS post_visit_billing_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        suggestion_id UUID REFERENCES post_visit_billing_suggestions(id) ON DELETE CASCADE,
        action VARCHAR(30) NOT NULL CHECK (action IN ('generated','approved','rejected','refreshed')),
        action_by UUID REFERENCES users(id) ON DELETE SET NULL,
        action_note TEXT,
        before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_session ON post_visit_billing_suggestions(session_id, status, code_type, confidence DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_patient ON post_visit_billing_suggestions(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_code ON post_visit_billing_suggestions(code_type, code)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_billing_audit_session ON post_visit_billing_audit_log(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_billing_audit_suggestion ON post_visit_billing_audit_log(suggestion_id, created_at DESC)`,
      `DROP TRIGGER IF EXISTS update_post_visit_billing_suggestions_updated_at ON post_visit_billing_suggestions`,
      `CREATE TRIGGER update_post_visit_billing_suggestions_updated_at
        BEFORE UPDATE ON post_visit_billing_suggestions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint54PostVisitPreVisitBriefSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_previsit_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','archived')),
        brief_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        follow_up_risk_score INTEGER NOT NULL DEFAULT 0,
        follow_up_risk_tier VARCHAR(20) NOT NULL DEFAULT 'low'
          CHECK (follow_up_risk_tier IN ('low','moderate','high','critical')),
        follow_up_risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        nudge_policy VARCHAR(120),
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_previsit_brief_v1',
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS post_visit_previsit_briefs
        ADD COLUMN IF NOT EXISTS appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','archived')),
        ADD COLUMN IF NOT EXISTS brief_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS follow_up_risk_score INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS follow_up_risk_tier VARCHAR(20) NOT NULL DEFAULT 'low'
          CHECK (follow_up_risk_tier IN ('low','moderate','high','critical')),
        ADD COLUMN IF NOT EXISTS follow_up_risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS nudge_policy VARCHAR(120),
        ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'post_visit_previsit_brief_v1',
        ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_appointment ON post_visit_previsit_briefs(appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_patient ON post_visit_previsit_briefs(patient_id, generated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_doctor ON post_visit_previsit_briefs(doctor_id, generated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_risk ON post_visit_previsit_briefs(follow_up_risk_tier, follow_up_risk_score DESC)`,
      `DROP TRIGGER IF EXISTS update_post_visit_previsit_briefs_updated_at ON post_visit_previsit_briefs`,
      `CREATE TRIGGER update_post_visit_previsit_briefs_updated_at
        BEFORE UPDATE ON post_visit_previsit_briefs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint55PostVisitAdminDocsSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_admin_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        document_type VARCHAR(40) NOT NULL
          CHECK (document_type IN ('referral_letter','sick_note','return_to_work')),
        version_no INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'signed'
          CHECK (status IN ('draft','signed','dispatched','voided')),
        title VARCHAR(255) NOT NULL,
        body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        immutable_hash VARCHAR(128) NOT NULL,
        signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        signed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, document_type, version_no)
      )`,
      `ALTER TABLE IF EXISTS post_visit_admin_documents
        ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS document_type VARCHAR(40)
          CHECK (document_type IN ('referral_letter','sick_note','return_to_work')),
        ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'signed'
          CHECK (status IN ('draft','signed','dispatched','voided')),
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS immutable_hash VARCHAR(128),
        ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_session ON post_visit_admin_documents(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_patient ON post_visit_admin_documents(patient_id, document_type, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_hash ON post_visit_admin_documents(immutable_hash)`,
      `DROP TRIGGER IF EXISTS update_post_visit_admin_documents_updated_at ON post_visit_admin_documents`,
      `CREATE TRIGGER update_post_visit_admin_documents_updated_at
        BEFORE UPDATE ON post_visit_admin_documents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint56PostVisitTrialMemorySchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_trial_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        trial_source VARCHAR(40) NOT NULL DEFAULT 'clinicaltrials_gov_v2',
        trial_id VARCHAR(80) NOT NULL,
        trial_title TEXT NOT NULL,
        trial_phase VARCHAR(80),
        trial_status VARCHAR(80),
        condition_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_url TEXT,
        eligibility_score INTEGER NOT NULL DEFAULT 0,
        eligibility_rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
        match_status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (match_status IN ('proposed','considered','deferred','excluded','enrolled')),
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        review_note TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, trial_id)
      )`,
      `ALTER TABLE IF EXISTS post_visit_trial_matches
        ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS trial_source VARCHAR(40) NOT NULL DEFAULT 'clinicaltrials_gov_v2',
        ADD COLUMN IF NOT EXISTS trial_id VARCHAR(80),
        ADD COLUMN IF NOT EXISTS trial_title TEXT,
        ADD COLUMN IF NOT EXISTS trial_phase VARCHAR(80),
        ADD COLUMN IF NOT EXISTS trial_status VARCHAR(80),
        ADD COLUMN IF NOT EXISTS condition_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS source_url TEXT,
        ADD COLUMN IF NOT EXISTS eligibility_score INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS eligibility_rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (match_status IN ('proposed','considered','deferred','excluded','enrolled')),
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS review_note TEXT,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE TABLE IF NOT EXISTS post_visit_trial_match_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        trial_match_id UUID NOT NULL REFERENCES post_visit_trial_matches(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL
          CHECK (action IN ('consider','defer','exclude','enroll')),
        previous_status VARCHAR(20)
          CHECK (previous_status IN ('proposed','considered','deferred','excluded','enrolled')),
        next_status VARCHAR(20) NOT NULL
          CHECK (next_status IN ('proposed','considered','deferred','excluded','enrolled')),
        note TEXT,
        acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS post_visit_trial_match_audit_log
        ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS trial_match_id UUID REFERENCES post_visit_trial_matches(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS action VARCHAR(20)
          CHECK (action IN ('consider','defer','exclude','enroll')),
        ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20)
          CHECK (previous_status IN ('proposed','considered','deferred','excluded','enrolled')),
        ADD COLUMN IF NOT EXISTS next_status VARCHAR(20)
          CHECK (next_status IN ('proposed','considered','deferred','excluded','enrolled')),
        ADD COLUMN IF NOT EXISTS note TEXT,
        ADD COLUMN IF NOT EXISTS acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE TABLE IF NOT EXISTS post_visit_companion_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        memory_type VARCHAR(60) NOT NULL,
        memory_key VARCHAR(120) NOT NULL,
        memory_value TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        source_message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
        created_by UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        promoted_at TIMESTAMP WITH TIME ZONE,
        promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        retired_at TIMESTAMP WITH TIME ZONE,
        retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
        curation_note TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS post_visit_companion_memory
        ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS memory_type VARCHAR(60),
        ADD COLUMN IF NOT EXISTS memory_key VARCHAR(120),
        ADD COLUMN IF NOT EXISTS memory_value TEXT,
        ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS created_by UUID,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS retired_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS curation_note TEXT,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_session ON post_visit_trial_matches(session_id, eligibility_score DESC, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_patient ON post_visit_trial_matches(patient_id, match_status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_trial_id ON post_visit_trial_matches(trial_id)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_session ON post_visit_trial_match_audit_log(session_id, acted_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_match ON post_visit_trial_match_audit_log(trial_match_id, acted_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_actor ON post_visit_trial_match_audit_log(acted_by, acted_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_patient ON post_visit_companion_memory(patient_id, is_active, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_session ON post_visit_companion_memory(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_key ON post_visit_companion_memory(memory_type, memory_key, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_curation ON post_visit_companion_memory(patient_id, promoted_at DESC, retired_at DESC)`,
      `DROP TRIGGER IF EXISTS update_post_visit_trial_matches_updated_at ON post_visit_trial_matches`,
      `CREATE TRIGGER update_post_visit_trial_matches_updated_at
        BEFORE UPDATE ON post_visit_trial_matches
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_trial_match_audit_log_updated_at ON post_visit_trial_match_audit_log`,
      `CREATE TRIGGER update_post_visit_trial_match_audit_log_updated_at
        BEFORE UPDATE ON post_visit_trial_match_audit_log
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_post_visit_companion_memory_updated_at ON post_visit_companion_memory`,
      `CREATE TRIGGER update_post_visit_companion_memory_updated_at
        BEFORE UPDATE ON post_visit_companion_memory
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint57PostVisitDocumentIntelligenceAndNotificationsSchemaStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS post_visit_document_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_type VARCHAR(40) NOT NULL
          CHECK (document_type IN ('lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other')),
        document_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120),
        file_size INTEGER,
        file_sha256 VARCHAR(128) NOT NULL,
        duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
        duplicate_similarity DOUBLE PRECISION,
        extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
          CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
        ocr_engine VARCHAR(120),
        ocr_confidence DOUBLE PRECISION,
        extracted_text TEXT,
        structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
        critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
        critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
        escalation_event_id UUID,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS post_visit_document_intelligence
        ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS duplicate_similarity DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
          CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
        ADD COLUMN IF NOT EXISTS ocr_engine VARCHAR(120),
        ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS extracted_text TEXT,
        ADD COLUMN IF NOT EXISTS structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS escalation_event_id UUID,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_session
        ON post_visit_document_intelligence(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_hash
        ON post_visit_document_intelligence(session_id, file_sha256)`,
      `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_critical
        ON post_visit_document_intelligence(session_id, critical_detected, created_at DESC)`,
      `DROP TRIGGER IF EXISTS update_post_visit_document_intelligence_updated_at ON post_visit_document_intelligence`,
      `CREATE TRIGGER update_post_visit_document_intelligence_updated_at
        BEFORE UPDATE ON post_visit_document_intelligence
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TABLE IF NOT EXISTS patient_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(120) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        action_url VARCHAR(500),
        action_label VARCHAR(100),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE IF EXISTS patient_notifications
        ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS message TEXT,
        ADD COLUMN IF NOT EXISTS action_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS action_label VARCHAR(100),
        ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS metadata JSONB,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notifications_tenant ON patient_notifications(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notifications_patient ON patient_notifications(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notifications_patient_read ON patient_notifications(patient_id, read)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notifications_type ON patient_notifications(notification_type)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notifications_sent_at ON patient_notifications(sent_at DESC)`,
    ];
  }

  private getSprint58PostVisitAudioStorageSchemaStatements(): string[] {
    return [
      `ALTER TABLE IF EXISTS post_visit_sessions
       ADD COLUMN IF NOT EXISTS recording_storage_key   VARCHAR(500),
       ADD COLUMN IF NOT EXISTS recording_bucket         VARCHAR(120)  DEFAULT 'post-visit-recordings',
       ADD COLUMN IF NOT EXISTS recording_mime_type       VARCHAR(60),
       ADD COLUMN IF NOT EXISTS recording_size_bytes      BIGINT,
       ADD COLUMN IF NOT EXISTS recording_duration_ms     INTEGER,
       ADD COLUMN IF NOT EXISTS recording_sha256          VARCHAR(64),
       ADD COLUMN IF NOT EXISTS recording_uploaded_at     TIMESTAMP WITH TIME ZONE`,
    ];
  }

  private getSprintE1ImmunizationAlignmentStatements(): string[] {
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

      // Routine childhood vaccines (EPI + CDC recommended)
      `INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
       SELECT v.* FROM (VALUES
         ('Hepatitis B - Birth', '45', 'Hepatitis B', 'infant', 1, 0, NULL, true, 'routine', CURRENT_DATE),
         ('Hepatitis B - Dose 2', '45', 'Hepatitis B', 'infant', 2, 1, 28, true, 'routine', CURRENT_DATE),
         ('Hepatitis B - Dose 3', '45', 'Hepatitis B', 'infant', 3, 6, 56, true, 'routine', CURRENT_DATE),
         ('OPV - Birth', '02', 'Oral Polio Vaccine', 'infant', 0, 0, NULL, true, 'routine', CURRENT_DATE),
         ('OPV - Dose 1', '02', 'Oral Polio Vaccine', 'infant', 1, 6, 28, true, 'routine', CURRENT_DATE),
         ('OPV - Dose 2', '02', 'Oral Polio Vaccine', 'infant', 2, 10, 28, true, 'routine', CURRENT_DATE),
         ('OPV - Dose 3', '02', 'Oral Polio Vaccine', 'infant', 3, 14, 28, true, 'routine', CURRENT_DATE),
         ('IPV', '10', 'Inactivated Polio Vaccine', 'infant', 1, 14, NULL, true, 'routine', CURRENT_DATE),
         ('Pentavalent - Dose 1', '170', 'DTP-HepB-Hib (Pentavalent)', 'infant', 1, 6, NULL, true, 'routine', CURRENT_DATE),
         ('Pentavalent - Dose 2', '170', 'DTP-HepB-Hib (Pentavalent)', 'infant', 2, 10, 28, true, 'routine', CURRENT_DATE),
         ('Pentavalent - Dose 3', '170', 'DTP-HepB-Hib (Pentavalent)', 'infant', 3, 14, 28, true, 'routine', CURRENT_DATE),
         ('PCV13 - Dose 1', '152', 'Pneumococcal Conjugate (PCV13)', 'infant', 1, 6, NULL, true, 'routine', CURRENT_DATE),
         ('PCV13 - Dose 2', '152', 'Pneumococcal Conjugate (PCV13)', 'infant', 2, 10, 28, true, 'routine', CURRENT_DATE),
         ('PCV13 - Dose 3', '152', 'Pneumococcal Conjugate (PCV13)', 'infant', 3, 14, 28, true, 'routine', CURRENT_DATE),
         ('Rotavirus - Dose 1', '119', 'Rotavirus (Rotarix)', 'infant', 1, 6, NULL, true, 'routine', CURRENT_DATE),
         ('Rotavirus - Dose 2', '119', 'Rotavirus (Rotarix)', 'infant', 2, 10, 28, true, 'routine', CURRENT_DATE),
         ('Measles - Dose 1', '05', 'Measles', 'infant', 1, 9, NULL, true, 'routine', CURRENT_DATE),
         ('MMR - Dose 1', '03', 'Measles-Mumps-Rubella', 'child', 1, 12, NULL, true, 'routine', CURRENT_DATE),
         ('MMR - Dose 2', '03', 'Measles-Mumps-Rubella', 'child', 2, 18, 28, true, 'routine', CURRENT_DATE),
         ('Varicella - Dose 1', '21', 'Varicella (Chickenpox)', 'child', 1, 12, NULL, true, 'routine', CURRENT_DATE),
         ('Varicella - Dose 2', '21', 'Varicella (Chickenpox)', 'child', 2, 48, 90, true, 'routine', CURRENT_DATE),
         ('DTaP - Dose 4', '20', 'DTaP Booster', 'child', 4, 15, NULL, true, 'routine', CURRENT_DATE),
         ('DTaP - Dose 5', '20', 'DTaP Booster', 'child', 5, 48, NULL, true, 'routine', CURRENT_DATE),
         ('Hepatitis A - Dose 1', '83', 'Hepatitis A', 'child', 1, 12, NULL, true, 'routine', CURRENT_DATE),
         ('Hepatitis A - Dose 2', '83', 'Hepatitis A', 'child', 2, 18, 180, true, 'routine', CURRENT_DATE),
         ('HPV - Dose 1', '137', 'HPV (Gardasil 9)', 'adolescent', 1, 108, NULL, true, 'routine', CURRENT_DATE),
         ('HPV - Dose 2', '137', 'HPV (Gardasil 9)', 'adolescent', 2, 114, 60, true, 'routine', CURRENT_DATE),
         ('Tdap Booster', '115', 'Tdap (Tetanus-Diphtheria-Pertussis)', 'adolescent', 1, 132, NULL, true, 'routine', CURRENT_DATE),
         ('Meningococcal ACWY', '147', 'Meningococcal ACWY (MenACWY)', 'adolescent', 1, 132, NULL, true, 'routine', CURRENT_DATE),
         ('Meningococcal ACWY Booster', '147', 'Meningococcal ACWY (MenACWY)', 'adolescent', 2, 192, NULL, true, 'routine', CURRENT_DATE),
         ('Influenza (Annual)', '141', 'Influenza (IIV4)', 'all_ages', 1, 6, NULL, false, 'routine', CURRENT_DATE),
         ('PPSV23', '33', 'Pneumococcal Polysaccharide (PPSV23)', 'adult', 1, 780, NULL, false, 'routine', CURRENT_DATE),
         ('Td Booster', '138', 'Td (Tetanus-Diphtheria)', 'adult', 1, NULL, 3650, false, 'routine', CURRENT_DATE),
         ('Shingles (Shingrix)', '187', 'Recombinant Zoster (Shingrix)', 'senior', 1, 600, NULL, false, 'routine', CURRENT_DATE),
         ('Shingles (Shingrix) Dose 2', '187', 'Recombinant Zoster (Shingrix)', 'senior', 2, 602, 60, false, 'routine', CURRENT_DATE),
         ('COVID-19 Primary', '213', 'COVID-19 mRNA', 'all_ages', 1, 6, NULL, false, 'routine', CURRENT_DATE)
       ) AS v(schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
       WHERE NOT EXISTS (SELECT 1 FROM immunization_schedules WHERE vaccine_code = v.vaccine_code AND dose_number = v.dose_number AND schedule_type = v.schedule_type)`,

      // Travel vaccines
      `INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
       SELECT v.* FROM (VALUES
         ('Japanese Encephalitis', '134', 'Japanese Encephalitis (Ixiaro)', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE),
         ('Rabies Pre-Exposure', '40', 'Rabies (Pre-Exposure)', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE),
         ('Cholera (Oral)', '26', 'Cholera Oral (Dukoral)', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE),
         ('Meningococcal ACWY Travel', '147', 'Meningococcal ACWY', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE),
         ('Tick-Borne Encephalitis', '77', 'TBE Vaccine', 'adult', 1, NULL, NULL, false, 'travel', CURRENT_DATE)
       ) AS v(schedule_name, vaccine_code, vaccine_name, age_group, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
       WHERE NOT EXISTS (SELECT 1 FROM immunization_schedules WHERE vaccine_code = v.vaccine_code AND schedule_type = 'travel')`,
    ];
  }

  private getSprintE3_2FAStatements(): string[] {
    return [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false`,
    ];
  }

  private getSprintF1ORSurgicalSafetyStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS surgical_safety_checklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
        sign_in_completed BOOLEAN DEFAULT false,
        sign_in_completed_at TIMESTAMP WITH TIME ZONE,
        sign_in_completed_by UUID REFERENCES users(id),
        patient_identity_confirmed BOOLEAN DEFAULT false,
        site_marked BOOLEAN DEFAULT false,
        consent_confirmed BOOLEAN DEFAULT false,
        anesthesia_safety_check BOOLEAN DEFAULT false,
        known_allergy BOOLEAN DEFAULT false,
        allergy_details TEXT,
        difficult_airway_risk BOOLEAN DEFAULT false,
        aspiration_risk BOOLEAN DEFAULT false,
        blood_loss_risk BOOLEAN DEFAULT false,
        blood_loss_estimated_ml INTEGER,
        time_out_completed BOOLEAN DEFAULT false,
        time_out_completed_at TIMESTAMP WITH TIME ZONE,
        time_out_completed_by UUID REFERENCES users(id),
        team_members_introduced BOOLEAN DEFAULT false,
        procedure_confirmed BOOLEAN DEFAULT false,
        site_confirmed BOOLEAN DEFAULT false,
        anticipated_critical_events TEXT,
        antibiotic_prophylaxis_given BOOLEAN DEFAULT false,
        antibiotic_time TIMESTAMP WITH TIME ZONE,
        imaging_displayed BOOLEAN DEFAULT false,
        sign_out_completed BOOLEAN DEFAULT false,
        sign_out_completed_at TIMESTAMP WITH TIME ZONE,
        sign_out_completed_by UUID REFERENCES users(id),
        procedure_recorded BOOLEAN DEFAULT false,
        instrument_sponge_needle_counts_correct BOOLEAN DEFAULT false,
        specimen_labelled BOOLEAN DEFAULT false,
        equipment_issues TEXT,
        key_concerns_recovery TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ssc_case ON surgical_safety_checklists(surgical_case_id)`,
      `CREATE TABLE IF NOT EXISTS surgical_count_sheets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
        count_type VARCHAR(30) NOT NULL CHECK (count_type IN ('sponge', 'needle', 'instrument', 'other')),
        item_name VARCHAR(255) NOT NULL,
        initial_count INTEGER NOT NULL,
        final_count INTEGER,
        count_correct BOOLEAN,
        discrepancy_note TEXT,
        counted_by UUID REFERENCES users(id),
        verified_by UUID REFERENCES users(id),
        count_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_count_case ON surgical_count_sheets(surgical_case_id)`,
      `CREATE TABLE IF NOT EXISTS surgical_specimens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
        specimen_type VARCHAR(100) NOT NULL,
        specimen_source VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        fixative VARCHAR(100) DEFAULT 'formalin',
        collected_by UUID REFERENCES users(id),
        collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        pathology_lab_order_id UUID,
        label_verified BOOLEAN DEFAULT false,
        label_verified_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_specimen_case ON surgical_specimens(surgical_case_id)`,
    ];
  }

  private getSprintF2BloodBankCrossmatchStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS blood_cross_match (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        inventory_id UUID REFERENCES blood_inventory(id),
        blood_group VARCHAR(10) NOT NULL,
        rh_factor VARCHAR(10) NOT NULL,
        antibody_screen VARCHAR(20) DEFAULT 'negative',
        antibody_identified TEXT,
        major_cross_match VARCHAR(20),
        minor_cross_match VARCHAR(20),
        cross_match_result VARCHAR(20) CHECK (cross_match_result IN ('compatible', 'incompatible', 'pending')),
        performed_by UUID REFERENCES users(id),
        performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_crossmatch_patient ON blood_cross_match(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crossmatch_inventory ON blood_cross_match(inventory_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crossmatch_result ON blood_cross_match(cross_match_result)`,
      `CREATE TABLE IF NOT EXISTS transfusion_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfusion_id UUID NOT NULL REFERENCES blood_transfusions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        reaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
        reaction_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
        symptoms TEXT,
        vitals_at_reaction JSONB,
        treatment_given TEXT,
        transfusion_stopped BOOLEAN DEFAULT true,
        blood_bank_notified BOOLEAN DEFAULT false,
        physician_notified BOOLEAN DEFAULT false,
        investigation_status VARCHAR(20) DEFAULT 'pending',
        investigation_findings TEXT,
        reported_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_txn_reaction_patient ON transfusion_reactions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_txn_reaction_transfusion ON transfusion_reactions(transfusion_id)`,
    ];
  }

  private getSprintF3InfectionSepsisStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS hand_hygiene_observations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        observer_id UUID NOT NULL REFERENCES users(id),
        observed_staff_id UUID REFERENCES users(id),
        observation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        department VARCHAR(100),
        opportunity_type VARCHAR(50) NOT NULL CHECK (opportunity_type IN (
          'before_patient_contact', 'before_aseptic_task', 'after_body_fluid_exposure',
          'after_patient_contact', 'after_surroundings_contact'
        )),
        hand_hygiene_performed BOOLEAN NOT NULL,
        method VARCHAR(30) CHECK (method IN ('soap_and_water', 'alcohol_rub', 'none')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_hh_date ON hand_hygiene_observations(observation_date)`,
      `CREATE INDEX IF NOT EXISTS idx_hh_department ON hand_hygiene_observations(department)`,
      `CREATE TABLE IF NOT EXISTS device_day_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('central_line', 'urinary_catheter', 'ventilator')),
        inserted_date DATE NOT NULL,
        removed_date DATE,
        inserted_by UUID REFERENCES users(id),
        location VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_device_patient ON device_day_tracking(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_device_type ON device_day_tracking(device_type)`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS lactate_measured_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS blood_cultures_drawn_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS antibiotics_given_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS fluid_bolus_given_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS vasopressors_initiated_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS sepsis_onset_time TIMESTAMP WITH TIME ZONE`,
    ];
  }

  private getSprintF4BcmaMarStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS mar_scheduled_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        medication_name VARCHAR(255) NOT NULL,
        dose VARCHAR(100) NOT NULL,
        unit VARCHAR(50),
        route VARCHAR(50),
        frequency VARCHAR(100),
        scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'administered', 'held', 'refused', 'missed', 'late')),
        mar_id UUID REFERENCES medication_administration_records(id),
        requires_witness BOOLEAN DEFAULT false,
        is_high_alert BOOLEAN DEFAULT false,
        is_controlled BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mar_sched_patient ON mar_scheduled_entries(patient_id, scheduled_time)`,
      `CREATE INDEX IF NOT EXISTS idx_mar_sched_status ON mar_scheduled_entries(status)`,
      `CREATE INDEX IF NOT EXISTS idx_mar_sched_prescription ON mar_scheduled_entries(prescription_id)`,
    ];
  }

  private getSprintG2EncounterCodingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS encounter_code_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(100),
        appointment_id UUID,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        suggested_icd10 JSONB DEFAULT '[]'::jsonb,
        suggested_cpt JSONB DEFAULT '[]'::jsonb,
        em_level VARCHAR(10),
        em_rationale TEXT,
        suggested_modifiers JSONB DEFAULT '[]'::jsonb,
        confidence DOUBLE PRECISION,
        source VARCHAR(30) DEFAULT 'ai',
        accepted_codes JSONB DEFAULT '[]'::jsonb,
        rejected_codes JSONB DEFAULT '[]'::jsonb,
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_enc_codes_patient ON encounter_code_suggestions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_enc_codes_appointment ON encounter_code_suggestions(appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_enc_codes_session ON encounter_code_suggestions(session_id)`,
    ];
  }

  private getSprintG3SchedulingAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS appointment_no_show_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id),
        no_show_probability DOUBLE PRECISION NOT NULL,
        risk_factors JSONB DEFAULT '[]'::jsonb,
        suggested_action VARCHAR(50),
        action_taken VARCHAR(50),
        model_version VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_noshow_appointment ON appointment_no_show_predictions(appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_noshow_patient ON appointment_no_show_predictions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_noshow_probability ON appointment_no_show_predictions(no_show_probability DESC)`,
    ];
  }

  private getSprintG4PopulationHealthStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS chronic_disease_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        condition_code VARCHAR(20) NOT NULL,
        condition_name VARCHAR(255) NOT NULL,
        condition_type VARCHAR(50) CHECK (condition_type IN ('hypertension','diabetes','asthma','copd','ckd','heart_failure','obesity','depression','other')),
        onset_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','controlled','uncontrolled','remission','resolved')),
        risk_level VARCHAR(20) DEFAULT 'moderate' CHECK (risk_level IN ('low','moderate','high','critical')),
        last_review_date DATE,
        next_review_date DATE,
        care_team JSONB DEFAULT '[]'::jsonb,
        management_plan TEXT,
        target_metrics JSONB DEFAULT '{}'::jsonb,
        current_metrics JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cdr_patient ON chronic_disease_registry(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cdr_condition ON chronic_disease_registry(condition_type)`,
      `CREATE INDEX IF NOT EXISTS idx_cdr_status ON chronic_disease_registry(status)`,
      `CREATE INDEX IF NOT EXISTS idx_cdr_risk ON chronic_disease_registry(risk_level)`,
      `CREATE INDEX IF NOT EXISTS idx_cdr_next_review ON chronic_disease_registry(next_review_date)`,
      `CREATE TABLE IF NOT EXISTS preventive_care_reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        screening_type VARCHAR(100) NOT NULL,
        recommended_by VARCHAR(100) DEFAULT 'USPSTF',
        due_date DATE,
        last_completed_date DATE,
        status VARCHAR(20) DEFAULT 'due' CHECK (status IN ('due','overdue','completed','declined','not_applicable')),
        reminder_sent BOOLEAN DEFAULT false,
        reminder_sent_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pcr_patient ON preventive_care_reminders(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pcr_status ON preventive_care_reminders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_pcr_due ON preventive_care_reminders(due_date)`,
      `CREATE TABLE IF NOT EXISTS recall_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        criteria JSONB NOT NULL,
        patient_count INTEGER DEFAULT 0,
        last_generated_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_recall_name ON recall_lists(name)`,
    ];
  }

  private getWhoSmartFormsDataSchemaStatements(): string[] {
    return [
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_tests_who_smart_form_data ON hiv_tests USING GIN(who_smart_form_data)`,
      `ALTER TABLE hiv_care_enrollments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_who_smart_form_data ON hiv_care_enrollments USING GIN(who_smart_form_data)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_clinical_visits_who_smart_form_data ON hiv_clinical_visits USING GIN(who_smart_form_data)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_tb_screenings_who_smart_form_data ON tb_screenings USING GIN(who_smart_form_data)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_who_smart_form_data ON appointments USING GIN(who_smart_form_data)`,
      `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_who_smart_form_data ON medical_records USING GIN(who_smart_form_data)`,
    ];
  }

  async createDatabase(databaseName: string, tenantSlug?: string): Promise<string> {
    try {
      this.assertSafeDatabaseName(databaseName);
      this.logger.log(`Creating database: ${databaseName}`);

      // Create database
      await this.dataSource.query(`CREATE DATABASE "${databaseName}"`);

      // Generate connection string
      const connectionString = this.generateConnectionString(databaseName);

      // Run schema migration
      await this.applyClinicSchema(connectionString, { tenantSlug });
      
      this.logger.log(`Database ${databaseName} created successfully`);
      return connectionString;
      
    } catch (error) {
      this.logger.error(`Failed to create database ${databaseName}:`, error);
      throw error;
    }
  }

  private generateConnectionString(databaseName: string): string {
    const host = process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'postgres-master';
    const port = process.env.DB_PORT || '5432';
    const username = process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres';
    const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres';
    
    return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
  }

  // Make schema application callable and idempotent
  public async applyClinicSchema(
    connectionString: string,
    options?: ApplySchemaOptions,
  ): Promise<ApplySchemaResult> {
    const tenantDataSource = new DataSource({
      name: `tenant_${Date.now()}`,
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      await this.ensureSchemaVersionTable(tenantDataSource);

      const bundles = this.getProvisioningBundles();
      const selectedBundles = options?.bundles?.length
        ? bundles.filter((bundle) => options.bundles!.includes(bundle.id))
        : bundles;
      let pendingBundles = [...selectedBundles];
      const maxPasses = Math.max(1, options?.maxPasses ?? Math.max(2, selectedBundles.length));
      const failedBundleSummary = new Map<string, { attempts: number; lastError: string }>();

      for (let pass = 1; pass <= maxPasses && pendingBundles.length > 0; pass += 1) {
        this.emitProvisioningEvent('schema.apply.pass.start', {
          pass,
          maxPasses,
          pendingCount: pendingBundles.length,
        });

        const stillPending: ProvisioningBundle[] = [];
        let appliedInPass = 0;

        for (const bundle of pendingBundles) {
          const alreadyApplied = await this.hasBundleVersion(tenantDataSource, bundle.id, bundle.version);
          if (alreadyApplied) {
            this.emitProvisioningEvent('bundle.apply.skip', {
              bundleId: bundle.id,
              version: bundle.version,
              reason: 'already_applied',
            });
            failedBundleSummary.delete(bundle.id);
            continue;
          }

          this.emitProvisioningEvent('bundle.apply.start', {
            bundleId: bundle.id,
            version: bundle.version,
            pass,
            connection: connectionString.replace(/:\/\/.*@/, '://***@'),
          });

          const bundleErrors: Array<{ phase: 'statement' | 'trigger' | 'task'; message: string; sqlPreview?: string }> = [];
          const statements = this.resolveBundleStatements(bundle);
          for (const statement of statements) {
            if (!statement.trim()) continue;
            try {
              await tenantDataSource.query(statement);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              this.emitProvisioningEvent('bundle.statement.error', {
                bundleId: bundle.id,
                message,
                sqlPreview: statement.substring(0, 200),
              });
              bundleErrors.push({
                phase: 'statement',
                message,
                sqlPreview: statement.substring(0, 200),
              });
            }
          }

          if (bundle.triggers) {
            const triggerStatements = bundle.triggers();
            for (const statement of triggerStatements) {
              if (!statement.trim()) continue;
              try {
                await tenantDataSource.query(statement);
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                this.emitProvisioningEvent('bundle.trigger.error', {
                  bundleId: bundle.id,
                  message,
                  sqlPreview: statement.substring(0, 200),
                });
                bundleErrors.push({
                  phase: 'trigger',
                  message,
                  sqlPreview: statement.substring(0, 200),
                });
              }
            }
          }

          if (bundle.tasks?.length) {
            for (const task of bundle.tasks) {
              try {
                await task(tenantDataSource);
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                this.emitProvisioningEvent('bundle.task.error', {
                  bundleId: bundle.id,
                  message,
                });
                bundleErrors.push({
                  phase: 'task',
                  message,
                });
              }
            }
          }

          if (bundleErrors.length > 0) {
            const firstError = bundleErrors[0]?.message || 'Unknown error';
            const previous = failedBundleSummary.get(bundle.id);
            failedBundleSummary.set(bundle.id, {
              attempts: (previous?.attempts || 0) + 1,
              lastError: firstError,
            });

            this.emitProvisioningEvent('bundle.apply.failed', {
              bundleId: bundle.id,
              version: bundle.version,
              pass,
              errorCount: bundleErrors.length,
              firstError,
            });
            stillPending.push(bundle);
            continue;
          }

          await this.recordBundleVersion(
            tenantDataSource,
            bundle.id,
            bundle.version,
            options?.appliedBy ?? 'provisioning_service',
          );

          appliedInPass += 1;
          failedBundleSummary.delete(bundle.id);
          this.emitProvisioningEvent('bundle.apply.success', {
            bundleId: bundle.id,
            version: bundle.version,
            pass,
          });
        }

        this.emitProvisioningEvent('schema.apply.pass.complete', {
          pass,
          appliedInPass,
          stillPending: stillPending.length,
        });

        pendingBundles = stillPending;

        if (pendingBundles.length === 0) {
          break;
        }

        // Stop if no bundle succeeded in this pass; remaining bundles need external fix.
        if (appliedInPass === 0) {
          break;
        }
      }

      if (pendingBundles.length > 0) {
        const unresolved = pendingBundles.map((bundle) => {
          const summary = failedBundleSummary.get(bundle.id);
          return {
            bundleId: bundle.id,
            version: bundle.version,
            attempts: summary?.attempts || 0,
            lastError: summary?.lastError || 'Unknown error',
          };
        });

        this.emitProvisioningEvent('schema.apply.incomplete', {
          pendingCount: unresolved.length,
          unresolved,
        });

        if (options?.strict !== false) {
          throw new Error(
            `Schema provisioning incomplete: ${unresolved.map((u) => `${u.bundleId} (${u.lastError})`).join('; ')}`,
          );
        }

        // Seed demo users even in non-strict mode (partial schema is still usable)
        if (options?.tenantSlug) {
          try {
            await this.seedDefaultUsers(tenantDataSource, options.tenantSlug);
          } catch (e) {
            this.logger.warn(`seedDefaultUsers failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return {
          pendingBundles: unresolved,
        };
      }

      this.logger.log(
        `Schema migration completed${pendingBundles.length > 0 ? ` with ${pendingBundles.length} unresolved bundle(s)` : ''}`,
      );

      // Seed demo users when a tenant slug is provided (frictionless demo setup)
      if (options?.tenantSlug) {
        try {
          await this.seedDefaultUsers(tenantDataSource, options.tenantSlug);
        } catch (e) {
          this.logger.warn(`seedDefaultUsers failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return {
        pendingBundles: [],
      };

    } finally {
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }

  private getClinicSchema(): string[] {
    const schema = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'nurse_accounts', 'receptionist', 'admin', 'pharmacist', 'lab_tech', 'radiologist', 'accounts')),
          license_number VARCHAR(100),
          specialization VARCHAR(100),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          must_change_password BOOLEAN DEFAULT false,
          password_changed_at TIMESTAMP WITH TIME ZONE,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE patients (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_number VARCHAR(50) UNIQUE NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          date_of_birth DATE NOT NULL,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          id_number VARCHAR(50) UNIQUE,
          phone VARCHAR(50),
          email VARCHAR(255),
          address TEXT,
          city VARCHAR(100),
          emergency_contact_name VARCHAR(200),
          emergency_contact_phone VARCHAR(50),
          medical_aid_name VARCHAR(100),
          medical_aid_number VARCHAR(100),
          medical_aid_plan VARCHAR(100),
          blood_type VARCHAR(5),
          allergies TEXT,
          chronic_conditions TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Patient Medical History (Sprint 5)
      CREATE TABLE IF NOT EXISTS patient_medical_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('diagnosis', 'surgery', 'procedure', 'injury', 'hospitalization', 'other')),
          condition_name VARCHAR(255) NOT NULL,
          snomed_concept_id VARCHAR(50),
          snomed_term TEXT,
          diagnosis_date DATE,
          resolved_date DATE,
          status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic', 'history')),
          severity VARCHAR(50),
          notes TEXT,
          treating_physician VARCHAR(255),
          facility_name VARCHAR(255),
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_medical_history_patient_id ON patient_medical_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medical_history_snomed_concept_id ON patient_medical_history(snomed_concept_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medical_history_status ON patient_medical_history(status);
      CREATE INDEX IF NOT EXISTS idx_patient_medical_history_diagnosis_date ON patient_medical_history(diagnosis_date);
      
      -- Patient Family History (Sprint 5)
      CREATE TABLE IF NOT EXISTS patient_family_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('mother', 'father', 'sibling', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'other')),
          relative_name VARCHAR(255),
          condition_name VARCHAR(255) NOT NULL,
          snomed_concept_id VARCHAR(50),
          snomed_term TEXT,
          age_at_onset INTEGER,
          age_at_death INTEGER,
          cause_of_death VARCHAR(255),
          notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_family_history_patient_id ON patient_family_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_family_history_relationship ON patient_family_history(relationship);
      CREATE INDEX IF NOT EXISTS idx_patient_family_history_snomed_concept_id ON patient_family_history(snomed_concept_id);
      
      -- Patient Social History (Sprint 5)
      CREATE TABLE IF NOT EXISTS patient_social_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          history_type VARCHAR(50) NOT NULL CHECK (history_type IN ('smoking', 'alcohol', 'drug_use', 'occupation', 'exercise', 'diet', 'travel', 'sexual_history', 'other')),
          status VARCHAR(50),
          frequency VARCHAR(100),
          quantity VARCHAR(100),
          start_date DATE,
          end_date DATE,
          notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_social_history_patient_id ON patient_social_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_social_history_history_type ON patient_social_history(history_type);
      
      -- Patient Documents (Sprint 5)
      CREATE TABLE IF NOT EXISTS patient_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('id_card', 'insurance_card', 'medical_report', 'lab_result', 'imaging_result', 'prescription', 'certificate', 'other')),
          document_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500),
          file_url TEXT,
          file_size INTEGER,
          mime_type VARCHAR(100),
          description TEXT,
          uploaded_by UUID REFERENCES users(id),
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_documents_document_type ON patient_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_patient_documents_uploaded_at ON patient_documents(uploaded_at);
      
      -- Clinical Note Templates (Sprint 5)
      CREATE TABLE IF NOT EXISTS clinical_note_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL CHECK (category IN ('SOAP', 'H&P', 'Progress', 'Discharge', 'Procedure', 'Consultation', 'Other')),
          content TEXT NOT NULL,
          variables JSONB DEFAULT '[]'::jsonb,
          specialty VARCHAR(100),
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          usage_count INTEGER DEFAULT 0,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_category ON clinical_note_templates(category);
      CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_specialty ON clinical_note_templates(specialty);
      CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_is_active ON clinical_note_templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_is_default ON clinical_note_templates(is_default);
      
      -- Patient Medications (Sprint 5)
      CREATE TABLE IF NOT EXISTS patient_medications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          medication_name VARCHAR(255) NOT NULL,
          generic_name VARCHAR(255),
          snomed_concept_id VARCHAR(50),
          snomed_term TEXT,
          medication_type VARCHAR(50) NOT NULL CHECK (medication_type IN ('current', 'past', 'allergy', 'discontinued')),
          dosage VARCHAR(100) NOT NULL,
          dosage_unit VARCHAR(50),
          frequency VARCHAR(100) NOT NULL,
          route VARCHAR(50) CHECK (route IN ('oral', 'injection', 'topical', 'inhalation', 'intravenous', 'sublingual', 'rectal', 'other')),
          duration VARCHAR(100),
          start_date DATE,
          end_date DATE,
          prescribed_by UUID REFERENCES users(id),
          prescribing_physician_name VARCHAR(255),
          prescription_id UUID REFERENCES prescriptions(id),
          status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed', 'allergy', 'on_hold')),
          reason_for_discontinuation TEXT,
          adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
          last_taken_date DATE,
          notes TEXT,
          reconciliation_status VARCHAR(50) DEFAULT 'verified' CHECK (reconciliation_status IN ('verified', 'needs_review', 'discrepancy', 'resolved')),
          reconciliation_notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON patient_medications(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_medication_type ON patient_medications(medication_type);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON patient_medications(status);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_snomed_concept_id ON patient_medications(snomed_concept_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_prescription_id ON patient_medications(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_reconciliation_status ON patient_medications(reconciliation_status);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_start_date ON patient_medications(start_date);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_end_date ON patient_medications(end_date);
      
      -- Medication Adherence Tracking (Sprint 5)
      CREATE TABLE IF NOT EXISTS medication_adherence (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          medication_id UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          adherence_date DATE NOT NULL,
          taken BOOLEAN DEFAULT false,
          missed_reason VARCHAR(255),
          notes TEXT,
          recorded_by UUID REFERENCES users(id),
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(medication_id, adherence_date)
      );
      CREATE INDEX IF NOT EXISTS idx_medication_adherence_medication_id ON medication_adherence(medication_id);
      CREATE INDEX IF NOT EXISTS idx_medication_adherence_patient_id ON medication_adherence(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medication_adherence_adherence_date ON medication_adherence(adherence_date);
      
      -- Medication Reconciliation Log (Sprint 5)
      CREATE TABLE IF NOT EXISTS medication_reconciliation_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          reconciliation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          reconciled_by UUID REFERENCES users(id),
          reconciliation_type VARCHAR(50) NOT NULL CHECK (reconciliation_type IN ('admission', 'transfer', 'discharge', 'outpatient_visit', 'pharmacy_visit')),
          source VARCHAR(100),
          discrepancies_found INTEGER DEFAULT 0,
          discrepancies_resolved INTEGER DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_medication_reconciliation_log_patient_id ON medication_reconciliation_log(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medication_reconciliation_log_reconciliation_date ON medication_reconciliation_log(reconciliation_date);
      CREATE INDEX IF NOT EXISTS idx_medication_reconciliation_log_reconciliation_type ON medication_reconciliation_log(reconciliation_type);
      
      -- Prescription Templates (Sprint 5)
      CREATE TABLE IF NOT EXISTS prescription_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL CHECK (category IN ('antibiotic', 'pain_management', 'hypertension', 'diabetes', 'respiratory', 'gastrointestinal', 'cardiac', 'mental_health', 'pediatric', 'other')),
          medication_name VARCHAR(255) NOT NULL,
          generic_name VARCHAR(255),
          dosage VARCHAR(100) NOT NULL,
          dosage_unit VARCHAR(50),
          frequency VARCHAR(100) NOT NULL,
          route VARCHAR(50) CHECK (route IN ('oral', 'injection', 'topical', 'inhalation', 'intravenous', 'sublingual', 'rectal', 'other')),
          duration VARCHAR(100),
          instructions TEXT,
          indications TEXT,
          contraindications TEXT,
          side_effects TEXT,
          specialty VARCHAR(100),
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          usage_count INTEGER DEFAULT 0,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_prescription_templates_category ON prescription_templates(category);
      CREATE INDEX IF NOT EXISTS idx_prescription_templates_specialty ON prescription_templates(specialty);
      CREATE INDEX IF NOT EXISTS idx_prescription_templates_is_active ON prescription_templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_prescription_templates_is_default ON prescription_templates(is_default);
      CREATE INDEX IF NOT EXISTS idx_prescription_templates_medication_name ON prescription_templates(medication_name);
      
      CREATE TABLE appointments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
          duration_minutes INTEGER DEFAULT 30,
          appointment_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('awaiting_payment', 'scheduled', 'confirmed', 'in_progress', 'in-progress', 'completed', 'cancelled', 'no_show', 'no-show')),
          reason TEXT,
          notes TEXT,
          fee_amount NUMERIC(12,2),
          finance_transaction_id UUID,
          payment_status VARCHAR(50) NOT NULL DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment', 'payment_confirmed', 'in_progress', 'completed', 'cancelled')),
          patient_instructions TEXT,
          priority_level VARCHAR(50) DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
          virtual_meeting_url VARCHAR(500),
          is_telehealth BOOLEAN DEFAULT false,
          check_in_time TIMESTAMP WITH TIME ZONE,
          actual_start_time TIMESTAMP WITH TIME ZONE,
          actual_end_time TIMESTAMP WITH TIME ZONE,
          wait_time_minutes INTEGER,
          recurring_pattern VARCHAR(100),
          parent_appointment_id UUID REFERENCES appointments(id),
          cancellation_reason TEXT,
          preparation_notes TEXT,
          estimated_cost DECIMAL(10,2),
          insurance_verified BOOLEAN DEFAULT false,
          reminder_sent_count INTEGER DEFAULT 0,
          last_reminder_sent TIMESTAMP WITH TIME ZONE,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          -- Diagnosis codes (Migration 030)
          diagnosis_snomed_code VARCHAR(50),
          diagnosis_snomed_term TEXT,
          primary_diagnosis_code VARCHAR(50),
          primary_diagnosis_description TEXT,
          diagnosis_codes TEXT[]
      );
      
      CREATE TABLE vitals (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          blood_pressure VARCHAR(20),
          heart_rate INTEGER,
          temperature DECIMAL(4,2),
          oxygen_saturation INTEGER,
          respiratory_rate INTEGER,
          weight DECIMAL(5,2),
          height DECIMAL(5,2),
          bmi DECIMAL(4,2),
          pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
          blood_glucose DECIMAL(5,2),
          notes TEXT,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE triage_assessments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          chief_complaint TEXT NOT NULL,
          chief_complaint_snomed_code VARCHAR(50),
          chief_complaint_snomed_term TEXT,
          chief_complaint_snomed_module_id VARCHAR(50),
          chief_complaint_snomed_definition_status VARCHAR(50),
          onset TEXT,
          pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
          allergies TEXT,
          medications TEXT,
          history TEXT,
          observations TEXT,
          observations_snomed JSONB DEFAULT '[]'::jsonb,
          priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 10),
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE nursing_notes (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('general', 'assessment', 'intervention', 'evaluation')),
          content TEXT NOT NULL,
          vital_signs TEXT,
          medications TEXT,
          observations TEXT,
          observations_snomed JSONB DEFAULT '[]'::jsonb,
          interventions TEXT,
          interventions_snomed JSONB DEFAULT '[]'::jsonb,
          outcomes TEXT,
          outcomes_snomed JSONB DEFAULT '[]'::jsonb,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('medication', 'procedure', 'lab_test', 'imaging', 'consultation', 'diet', 'activity')),
          order_name VARCHAR(255) NOT NULL,
          description TEXT,
          instructions TEXT NOT NULL,
          dosage VARCHAR(100),
          frequency VARCHAR(100),
          duration VARCHAR(100),
          priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'rejected')),
          drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
          snomed_concept_id VARCHAR(50),
          snomed_term TEXT,
          snomed_module_id VARCHAR(50),
          snomed_definition_status VARCHAR(50),
          external_codes JSONB DEFAULT '{}'::jsonb,
          authorized_by UUID REFERENCES users(id),
          authorized_at TIMESTAMP WITH TIME ZONE,
          executed_by UUID REFERENCES users(id),
          executed_at TIMESTAMP WITH TIME ZONE,
          execution_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE medical_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          record_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          file_path VARCHAR(500),
          file_type VARCHAR(100),
          file_size INTEGER,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE prescriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          medication_name VARCHAR(255) NOT NULL,
          medication_name_snomed_code VARCHAR(50),
          medication_name_snomed_term TEXT,
          medication_name_snomed_module_id VARCHAR(50),
          medication_name_snomed_definition_status VARCHAR(50),
          medication_name_rxnorm_code VARCHAR(50),
          medication_name_rxnorm_name TEXT,
          medication_name_rxnorm_tty VARCHAR(20),
          dosage VARCHAR(100) NOT NULL,
          frequency VARCHAR(100) NOT NULL,
          duration VARCHAR(100) NOT NULL,
          instructions TEXT,
          quantity INTEGER,
          refills INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE lab_results (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          test_name VARCHAR(255) NOT NULL,
          test_type VARCHAR(100) NOT NULL,
          result_value VARCHAR(255),
          result_unit VARCHAR(50),
          reference_range VARCHAR(100),
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'abnormal', 'critical')),
          notes TEXT,
          ordered_by UUID NOT NULL REFERENCES users(id),
          reviewed_by UUID REFERENCES users(id),
          ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE billing (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_id UUID REFERENCES appointments(id),
          billing_date DATE NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
          payment_method VARCHAR(50),
          payment_reference VARCHAR(255),
          notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE billing_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          billing_id UUID NOT NULL REFERENCES billing(id) ON DELETE CASCADE,
          item_name VARCHAR(255) NOT NULL,
          item_type VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE medical_aid_claims (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          billing_id UUID REFERENCES billing(id) ON DELETE SET NULL,
          claim_number VARCHAR(100) UNIQUE NOT NULL,
          medical_aid_name VARCHAR(100) NOT NULL,
          member_number VARCHAR(100) NOT NULL,
          claim_amount DECIMAL(10,2) NOT NULL,
          approved_amount DECIMAL(10,2),
          status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'rejected', 'paid')),
          submission_date TIMESTAMP WITH TIME ZONE,
          response_date TIMESTAMP WITH TIME ZONE,
          rejection_reason TEXT,
          claim_data JSONB,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          table_name VARCHAR(100) NOT NULL,
          record_id UUID,
          old_values JSONB,
          new_values JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
      CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
      CREATE INDEX idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX idx_appointments_status ON appointments(status);
      CREATE INDEX idx_appointments_payment_status ON appointments(payment_status);
      CREATE INDEX idx_appointments_parent_id ON appointments(parent_appointment_id);
      CREATE INDEX idx_appointments_priority ON appointments(priority_level);
      CREATE INDEX idx_appointments_telehealth ON appointments(is_telehealth);
      CREATE INDEX idx_appointments_created_by ON appointments(created_by);
      CREATE INDEX IF NOT EXISTS idx_appointments_diagnosis_snomed ON appointments(diagnosis_snomed_code);
      CREATE INDEX IF NOT EXISTS idx_appointments_primary_diagnosis_code ON appointments(primary_diagnosis_code);
      CREATE INDEX IF NOT EXISTS idx_appointments_diagnosis_codes ON appointments USING GIN(diagnosis_codes);
      
      CREATE INDEX idx_vitals_patient_id ON vitals(patient_id);
      CREATE INDEX idx_vitals_recorded_at ON vitals(recorded_at);
      CREATE INDEX idx_vitals_recorded_by ON vitals(recorded_by);
      
      CREATE INDEX idx_triage_patient_id ON triage_assessments(patient_id);
      CREATE INDEX idx_triage_priority ON triage_assessments(priority);
      CREATE INDEX idx_triage_recorded_at ON triage_assessments(recorded_at);
      CREATE INDEX idx_triage_recorded_by ON triage_assessments(recorded_by);
      CREATE INDEX idx_triage_chief_complaint_snomed ON triage_assessments(chief_complaint_snomed_code);
      CREATE INDEX idx_triage_observations_snomed ON triage_assessments USING GIN(observations_snomed);
      
      CREATE INDEX idx_nursing_notes_patient_id ON nursing_notes(patient_id);
      CREATE INDEX idx_nursing_notes_note_type ON nursing_notes(note_type);
      CREATE INDEX idx_nursing_notes_recorded_at ON nursing_notes(recorded_at);
      CREATE INDEX idx_nursing_notes_recorded_by ON nursing_notes(recorded_by);
      CREATE INDEX idx_nursing_notes_observations_snomed ON nursing_notes USING GIN(observations_snomed);
      CREATE INDEX idx_nursing_notes_interventions_snomed ON nursing_notes USING GIN(interventions_snomed);
      CREATE INDEX idx_nursing_notes_outcomes_snomed ON nursing_notes USING GIN(outcomes_snomed);
      
      CREATE INDEX idx_orders_patient_id ON orders(patient_id);
      CREATE INDEX idx_orders_appointment_id ON orders(appointment_id);
      CREATE INDEX idx_orders_doctor_id ON orders(doctor_id);
      CREATE INDEX idx_orders_status ON orders(status);
      CREATE INDEX idx_orders_type ON orders(order_type);
      CREATE INDEX idx_orders_authorized_by ON orders(authorized_by);
      CREATE INDEX idx_orders_executed_by ON orders(executed_by);
      CREATE INDEX idx_orders_created_at ON orders(created_at);
      
      CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
      CREATE INDEX idx_medical_records_type ON medical_records(record_type);
      
      CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
      CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
      CREATE INDEX idx_prescriptions_medication_snomed ON prescriptions(medication_name_snomed_code);
      
      CREATE INDEX idx_lab_results_patient_id ON lab_results(patient_id);
      CREATE INDEX idx_lab_results_status ON lab_results(status);
      
      CREATE INDEX idx_billing_patient_id ON billing(patient_id);
      CREATE INDEX idx_billing_status ON billing(status);
      
      CREATE INDEX idx_claims_patient_id ON medical_aid_claims(patient_id);
      CREATE INDEX idx_claims_status ON medical_aid_claims(status);
      
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
      
      -- HIPAA-compliant audit logging table
      CREATE TABLE IF NOT EXISTS hipaa_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          user_name VARCHAR(255),
          user_role VARCHAR(50),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100) NOT NULL,
          resource_id UUID,
          patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
          ip_address INET,
          user_agent TEXT,
          session_id VARCHAR(255),
          outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
          reason TEXT,
          data_accessed JSONB,
          old_values JSONB,
          new_values JSONB,
          metadata JSONB,
          risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- HIPAA audit log indexes for compliance reporting
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_user_id ON hipaa_audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_patient_id ON hipaa_audit_logs(patient_id);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_action ON hipaa_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_resource_type ON hipaa_audit_logs(resource_type);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_outcome ON hipaa_audit_logs(outcome);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_risk_level ON hipaa_audit_logs(risk_level);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_created_at ON hipaa_audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_session_id ON hipaa_audit_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_user_patient ON hipaa_audit_logs(user_id, patient_id);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_date_range ON hipaa_audit_logs(created_at, patient_id);
      
      -- HIPAA audit columns used by EHR and SOC2 evidence script (provision once)
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(80);
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS operation VARCHAR(20);
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20);
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(120);
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS ip_address_hash TEXT;
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS changes_delta JSONB;
      ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS immutable BOOLEAN NOT NULL DEFAULT TRUE;
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_event_type ON hipaa_audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_operation ON hipaa_audit_logs(operation);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_data_classification ON hipaa_audit_logs(data_classification);
      CREATE INDEX IF NOT EXISTS idx_hipaa_audit_request_id ON hipaa_audit_logs(request_id);
      
      -- Quality Measures Results Table
      CREATE TABLE IF NOT EXISTS quality_measure_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          measure_id VARCHAR(100) NOT NULL,
          measure_name TEXT NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          denominator INTEGER NOT NULL DEFAULT 0,
          numerator INTEGER NOT NULL DEFAULT 0,
          exclusions INTEGER NOT NULL DEFAULT 0,
          rate DECIMAL(5,2) NOT NULL,
          benchmark DECIMAL(5,2),
          status VARCHAR(20) CHECK (status IN ('met', 'not_met', 'partial')),
          numerator_patients TEXT[],
          denominator_patients TEXT[],
          exclusion_patients TEXT[],
          calculated_by UUID REFERENCES users(id) ON DELETE SET NULL,
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Quality measure indexes
      CREATE INDEX IF NOT EXISTS idx_quality_measure_id ON quality_measure_results(measure_id);
      CREATE INDEX IF NOT EXISTS idx_quality_measure_period ON quality_measure_results(period_start, period_end);
      CREATE INDEX IF NOT EXISTS idx_quality_measure_status ON quality_measure_results(status);
      CREATE INDEX IF NOT EXISTS idx_quality_measure_calculated_at ON quality_measure_results(calculated_at);
      
    `;
    
    // Split by semicolon but handle function definitions properly
    let statements = schema.split(';').filter(stmt => stmt.trim());
    
    // Add problems and allergies tables as separate statements (after split)
    statements.push(`
      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        code VARCHAR(50),
        code_system VARCHAR(50) NOT NULL DEFAULT 'SNOMED_CT',
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        snomed_module_id VARCHAR(50),
        snomed_definition_status VARCHAR(50),
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
        onset_date DATE,
        resolved_date DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`
      CREATE TABLE IF NOT EXISTS allergies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        allergen VARCHAR(255) NOT NULL,
        allergen_snomed_code VARCHAR(50),
        allergen_snomed_term TEXT,
        allergen_snomed_module_id VARCHAR(50),
        reaction TEXT,
        reaction_snomed_code VARCHAR(50),
        reaction_snomed_term TEXT,
        severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe')),
        severity_snomed_code VARCHAR(50),
        severity_snomed_term TEXT,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        recorded_by UUID REFERENCES users(id),
        verification_status VARCHAR(50),
        clinical_status VARCHAR(50)
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_patient_id ON problems(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_snomed_concept ON problems(snomed_concept_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_allergies_patient_id ON allergies(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_allergies_snomed_allergen ON allergies(allergen_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_allergies_reaction_snomed ON allergies(reaction_snomed_code)`);

    // Laboratory module
    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(255) NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        ordering_provider_id UUID NOT NULL REFERENCES users(id),
        medical_record_id UUID REFERENCES medical_records(id),
        tests JSONB NOT NULL,
        priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
        status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('awaiting_payment','ordered','collected','in_progress','completed','cancelled')),
        clinical_info TEXT,
        special_instructions TEXT,
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        snomed_module_id VARCHAR(50),
        snomed_definition_status VARCHAR(50),
        loinc_code VARCHAR(50),
        loinc_long_name TEXT,
        cpt_code VARCHAR(50),
        scheduled_date_time TIMESTAMP WITH TIME ZONE,
        collected_at TIMESTAMP WITH TIME ZONE,
        collected_by_id UUID REFERENCES users(id),
        results JSONB,
        interpretation TEXT,
        reviewed_by_id UUID REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        attachments JSONB,
        processing_context JSONB DEFAULT '{}'::jsonb,
        workflow_events JSONB DEFAULT '[]'::jsonb,
        handoff_notes JSONB DEFAULT '[]'::jsonb,
        notification_log JSONB DEFAULT '[]'::jsonb,
        fee_amount NUMERIC(12,2),
        finance_transaction_id UUID,
        payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_ordering_provider_id ON lab_orders(ordering_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_number ON lab_orders(order_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_payment_status ON lab_orders(payment_status)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loinc_code VARCHAR(50) UNIQUE,
        test_name VARCHAR(255) NOT NULL,
        test_code VARCHAR(50),
        category VARCHAR(100) NOT NULL,
        specimen_type VARCHAR(100) NOT NULL,
        unit VARCHAR(50),
        reference_range_male VARCHAR(100),
        reference_range_female VARCHAR(100),
        reference_range_general VARCHAR(100),
        critical_high DECIMAL(10,2),
        critical_low DECIMAL(10,2),
        description TEXT,
        instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc_code ON lab_tests(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_test_code ON lab_tests(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_is_active ON lab_tests(is_active)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_order_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        set_name VARCHAR(255) NOT NULL,
        set_code VARCHAR(50) UNIQUE,
        description TEXT,
        test_ids JSONB NOT NULL,
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_set_code ON lab_order_sets(set_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_category ON lab_order_sets(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_is_active ON lab_order_sets(is_active)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS critical_result_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        ordering_provider_id UUID NOT NULL REFERENCES users(id),
        test_code VARCHAR(50) NOT NULL,
        test_name VARCHAR(255) NOT NULL,
        result_value VARCHAR(255) NOT NULL,
        critical_value_type VARCHAR(20) CHECK (critical_value_type IN ('high','low','critical')),
        alert_message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')),
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledgment_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_lab_order_id ON critical_result_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_patient_id ON critical_result_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_ordering_provider_id ON critical_result_alerts(ordering_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_result_alerts(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_created_at ON critical_result_alerts(created_at)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_test_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_code VARCHAR(50) UNIQUE NOT NULL,
        loinc_code VARCHAR(50),
        test_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL CHECK (category IN ('Hematology','Chemistry','Microbiology','Immunology','Serology','Toxicology','Urinalysis','Cytology','Molecular','Other')),
        specimen_type VARCHAR(100) NOT NULL,
        specimen_volume VARCHAR(50),
        container_type VARCHAR(100),
        turnaround_time INTEGER,
        cost DECIMAL(10,2),
        description TEXT,
        clinical_significance TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_test_code ON lab_test_catalog(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_loinc_code ON lab_test_catalog(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_category ON lab_test_catalog(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_is_active ON lab_test_catalog(is_active)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_test_components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE,
        component_name VARCHAR(255) NOT NULL,
        component_code VARCHAR(50),
        loinc_code VARCHAR(50),
        unit VARCHAR(50),
        reference_range_min DECIMAL(10,4),
        reference_range_max DECIMAL(10,4),
        reference_range_text TEXT,
        critical_low DECIMAL(10,4),
        critical_high DECIMAL(10,4),
        age_specific BOOLEAN DEFAULT false,
        gender_specific BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_test_catalog_id ON lab_test_components(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_component_code ON lab_test_components(component_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_sort_order ON lab_test_components(sort_order)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_reference_ranges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID NOT NULL REFERENCES lab_test_components(id) ON DELETE CASCADE,
        age_min INTEGER,
        age_max INTEGER,
        gender VARCHAR(10) CHECK (gender IN ('male','female','all')),
        range_min DECIMAL(10,4),
        range_max DECIMAL(10,4),
        range_text TEXT,
        unit VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_component_id ON lab_reference_ranges(component_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_gender ON lab_reference_ranges(gender)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_order_set_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_set_id UUID NOT NULL REFERENCES lab_order_sets(id) ON DELETE CASCADE,
        test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_order_set_id ON lab_order_set_items(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_test_catalog_id ON lab_order_set_items(test_catalog_id)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_critical_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        lab_order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE,
        component_name VARCHAR(255) NOT NULL,
        result_value VARCHAR(100) NOT NULL,
        critical_range VARCHAR(100),
        severity VARCHAR(20) CHECK (severity IN ('critical','panic')) DEFAULT 'critical',
        alert_status VARCHAR(20) CHECK (alert_status IN ('pending','acknowledged','escalated')) DEFAULT 'pending',
        alerted_to UUID REFERENCES users(id),
        alerted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledgment_notes TEXT,
        escalated_to UUID REFERENCES users(id),
        escalated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_patient_id ON lab_critical_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_lab_order_id ON lab_critical_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alert_status ON lab_critical_alerts(alert_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alerted_to ON lab_critical_alerts(alerted_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_created_at ON lab_critical_alerts(created_at)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_quality_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analyzer_name VARCHAR(100) NOT NULL,
        test_code VARCHAR(50),
        level VARCHAR(50),
        lot_number VARCHAR(50),
        run_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        result_value VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','pass','fail','review')),
        comments TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_analyzer_name ON lab_quality_controls(analyzer_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_run_datetime ON lab_quality_controls(run_datetime)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_status ON lab_quality_controls(status)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS lab_reagent_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reagent_name VARCHAR(150) NOT NULL,
        analyzer_name VARCHAR(100),
        lot_number VARCHAR(50),
        quantity_available NUMERIC(10,2) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'units',
        minimum_threshold NUMERIC(10,2) DEFAULT 0,
        expires_on DATE,
        status VARCHAR(20) DEFAULT 'ok' CHECK (status IN ('ok','warning','critical','expired')),
        notes TEXT,
        updated_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_reagent_name ON lab_reagent_inventory(reagent_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_status ON lab_reagent_inventory(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_expires_on ON lab_reagent_inventory(expires_on)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_set_id ON lab_orders(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_test_catalog_id ON lab_orders(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_result_acknowledged ON lab_orders(result_acknowledged)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_snomed_concept ON lab_orders(snomed_concept_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_loinc_code ON lab_orders(loinc_code)`);

    // Medication catalog
    statements.push(`
      CREATE TABLE IF NOT EXISTS drugs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        generic_name VARCHAR(255) NOT NULL,
        brand_names TEXT[],
        atc_code VARCHAR(20),
        rxnorm_code VARCHAR(20),
        rxnorm_name TEXT,
        rxnorm_tty VARCHAR(20),
        snomed_code VARCHAR(50),
        snomed_term TEXT,
        ndc_code VARCHAR(50),
        strength VARCHAR(100),
        unit VARCHAR(50),
        drug_class VARCHAR(100),
        active_ingredients TEXT[],
        dosage_forms TEXT[],
        route_of_administration TEXT[],
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_atc_code ON drugs(atc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_status ON drugs(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_drug_class ON drugs(drug_class)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_is_active ON drugs(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_brand_names ON drugs USING GIN(brand_names)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS drug_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drug1_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
        drug2_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')),
        description TEXT NOT NULL,
        mechanism TEXT,
        management TEXT,
        evidence_level VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(drug1_id, drug2_id)
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug1_id ON drug_interactions(drug1_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug2_id ON drug_interactions(drug2_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_severity ON drug_interactions(severity)`);

    // Imaging module
    statements.push(`
      CREATE TABLE IF NOT EXISTS imaging_modalities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        modality_code VARCHAR(20) UNIQUE NOT NULL CHECK (modality_code IN ('XR','CT','MRI','US','MG','FL','NM','PET')),
        modality_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_modality_code ON imaging_modalities(modality_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_is_active ON imaging_modalities(is_active)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS imaging_study_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        modality_id UUID NOT NULL REFERENCES imaging_modalities(id) ON DELETE CASCADE,
        study_code VARCHAR(50) UNIQUE NOT NULL,
        study_name VARCHAR(255) NOT NULL,
        body_part VARCHAR(100),
        views TEXT[],
        typical_images INTEGER DEFAULT 1,
        contrast_required BOOLEAN DEFAULT false,
        cost DECIMAL(10,2),
        description TEXT,
        preparation_instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_modality_id ON imaging_study_types(modality_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_study_code ON imaging_study_types(study_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_body_part ON imaging_study_types(body_part)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_is_active ON imaging_study_types(is_active)`);

    statements.push(`
      CREATE TABLE IF NOT EXISTS imaging_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        study_type_id UUID NOT NULL REFERENCES imaging_study_types(id),
        ordering_provider UUID NOT NULL REFERENCES users(id),
        clinical_indication TEXT,
        clinical_history TEXT,
        suspected_diagnosis TEXT,
        icd10_codes TEXT[],
        priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
        order_status VARCHAR(30) DEFAULT 'ordered' CHECK (order_status IN ('awaiting_payment','ordered','scheduled','in_progress','awaiting_report','completed','cancelled')),
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        snomed_module_id VARCHAR(50),
        snomed_definition_status VARCHAR(50),
        cpt_code VARCHAR(50),
        ordered_at TIMESTAMP WITH TIME Zone DEFAULT NOW(),
        scheduled_date TIMESTAMP WITH TIME Zone,
        performed_at TIMESTAMP WITH TIME Zone,
        cancelled_at TIMESTAMP WITH TIME Zone,
        cancellation_reason TEXT,
        fee_amount NUMERIC(12,2),
        finance_transaction_id UUID,
        payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME Zone DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME Zone DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient_id ON imaging_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_number ON imaging_orders(order_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_study_type_id ON imaging_orders(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordering_provider ON imaging_orders(ordering_provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_status ON imaging_orders(order_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_payment_status ON imaging_orders(payment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordered_at ON imaging_orders(ordered_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_snomed_concept ON imaging_orders(snomed_concept_id)`);
    
    // Add lab_tests table (test catalog)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_tests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), loinc_code VARCHAR(50) UNIQUE, test_name VARCHAR(255) NOT NULL, test_code VARCHAR(50), category VARCHAR(100) NOT NULL, specimen_type VARCHAR(100) NOT NULL, unit VARCHAR(50), reference_range_male VARCHAR(100), reference_range_female VARCHAR(100), reference_range_general VARCHAR(100), critical_high DECIMAL(10,2), critical_low DECIMAL(10,2), description TEXT, instructions TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc_code ON lab_tests(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_test_code ON lab_tests(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_is_active ON lab_tests(is_active)`);
    
    // Add lab_order_sets table (predefined test groups)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_order_sets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), set_name VARCHAR(255) NOT NULL, set_code VARCHAR(50) UNIQUE, description TEXT, test_ids JSONB NOT NULL, category VARCHAR(100), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_set_code ON lab_order_sets(set_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_category ON lab_order_sets(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_is_active ON lab_order_sets(is_active)`);
    
    // Add critical_result_alerts table
    statements.push(`CREATE TABLE IF NOT EXISTS critical_result_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, ordering_provider_id UUID NOT NULL REFERENCES users(id), test_code VARCHAR(50) NOT NULL, test_name VARCHAR(255) NOT NULL, result_value VARCHAR(255) NOT NULL, critical_value_type VARCHAR(20) CHECK (critical_value_type IN ('high','low','critical')), alert_message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')), acknowledged_by UUID REFERENCES users(id), acknowledged_at TIMESTAMP WITH TIME ZONE, acknowledgment_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_lab_order_id ON critical_result_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_patient_id ON critical_result_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_ordering_provider_id ON critical_result_alerts(ordering_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_result_alerts(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_created_at ON critical_result_alerts(created_at)`);
    
    // Enhanced LIS: Lab Test Catalog (detailed test definitions)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_test_catalog (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), test_code VARCHAR(50) UNIQUE NOT NULL, loinc_code VARCHAR(50), test_name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL CHECK (category IN ('Hematology','Chemistry','Microbiology','Immunology','Serology','Toxicology','Urinalysis','Cytology','Molecular','Other')), specimen_type VARCHAR(100) NOT NULL, specimen_volume VARCHAR(50), container_type VARCHAR(100), turnaround_time INTEGER, cost DECIMAL(10,2), description TEXT, clinical_significance TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_test_code ON lab_test_catalog(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_loinc_code ON lab_test_catalog(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_category ON lab_test_catalog(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_is_active ON lab_test_catalog(is_active)`);
    
    // Enhanced LIS: Lab Test Components (individual measurable components of a test)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_test_components (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE, component_name VARCHAR(255) NOT NULL, component_code VARCHAR(50), loinc_code VARCHAR(50), unit VARCHAR(50), reference_range_min DECIMAL(10,4), reference_range_max DECIMAL(10,4), reference_range_text TEXT, critical_low DECIMAL(10,4), critical_high DECIMAL(10,4), age_specific BOOLEAN DEFAULT false, gender_specific BOOLEAN DEFAULT false, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_test_catalog_id ON lab_test_components(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_component_code ON lab_test_components(component_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_sort_order ON lab_test_components(sort_order)`);
    
    // Enhanced LIS: Lab Reference Ranges (age/gender specific ranges)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_reference_ranges (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), component_id UUID NOT NULL REFERENCES lab_test_components(id) ON DELETE CASCADE, age_min INTEGER, age_max INTEGER, gender VARCHAR(10) CHECK (gender IN ('male','female','all')), range_min DECIMAL(10,4), range_max DECIMAL(10,4), range_text TEXT, unit VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_component_id ON lab_reference_ranges(component_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_gender ON lab_reference_ranges(gender)`);
    
    // Enhanced LIS: Lab Order Set Items (junction table for order sets)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_order_set_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_set_id UUID NOT NULL REFERENCES lab_order_sets(id) ON DELETE CASCADE, test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_order_set_id ON lab_order_set_items(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_test_catalog_id ON lab_order_set_items(test_catalog_id)`);
    
    // Enhanced LIS: Lab Critical Alerts (enhanced version)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_critical_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, lab_order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE, component_name VARCHAR(255) NOT NULL, result_value VARCHAR(100) NOT NULL, critical_range VARCHAR(100), severity VARCHAR(20) CHECK (severity IN ('critical','panic')) DEFAULT 'critical', alert_status VARCHAR(20) CHECK (alert_status IN ('pending','acknowledged','escalated')) DEFAULT 'pending', alerted_to UUID REFERENCES users(id), alerted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), acknowledged_by UUID REFERENCES users(id), acknowledged_at TIMESTAMP WITH TIME ZONE, acknowledgment_notes TEXT, escalated_to UUID REFERENCES users(id), escalated_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_patient_id ON lab_critical_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_lab_order_id ON lab_critical_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alert_status ON lab_critical_alerts(alert_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alerted_to ON lab_critical_alerts(alerted_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_created_at ON lab_critical_alerts(created_at)`);
    
    // Enhanced LIS: Enhance lab_orders table with new columns
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS order_set_id UUID REFERENCES lab_order_sets(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS test_catalog_id UUID REFERENCES lab_test_catalog(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS ordering_provider UUID REFERENCES users(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS clinical_indication TEXT`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS icd10_codes TEXT[]`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_collected_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_received_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_reported_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_by UUID REFERENCES users(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS processing_context JSONB DEFAULT '{}'::jsonb`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS workflow_events JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS handoff_notes JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS notification_log JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS finance_transaction_id UUID`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'payment_confirmed'`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(50)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_long_name TEXT`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50)`);
    statements.push(`ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_status_check`);
    statements.push(`ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_status_check CHECK (status IN ('awaiting_payment','ordered','collected','in_progress','completed','cancelled'))`);
    statements.push(`ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_payment_status_check`);
    statements.push(`ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'))`);
    statements.push(`CREATE TABLE IF NOT EXISTS lab_quality_controls (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), analyzer_name VARCHAR(100) NOT NULL, test_code VARCHAR(50), level VARCHAR(50), lot_number VARCHAR(50), run_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(), result_value VARCHAR(100), status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','pass','fail','review')), comments TEXT, recorded_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_analyzer_name ON lab_quality_controls(analyzer_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_run_datetime ON lab_quality_controls(run_datetime)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_status ON lab_quality_controls(status)`);
    statements.push(`CREATE TABLE IF NOT EXISTS lab_reagent_inventory (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reagent_name VARCHAR(150) NOT NULL, analyzer_name VARCHAR(100), lot_number VARCHAR(50), quantity_available NUMERIC(10,2) DEFAULT 0, unit VARCHAR(20) DEFAULT 'units', minimum_threshold NUMERIC(10,2) DEFAULT 0, expires_on DATE, status VARCHAR(20) DEFAULT 'ok' CHECK (status IN ('ok','warning','critical','expired')), notes TEXT, updated_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_reagent_name ON lab_reagent_inventory(reagent_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_status ON lab_reagent_inventory(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_expires_on ON lab_reagent_inventory(expires_on)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_set_id ON lab_orders(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_test_catalog_id ON lab_orders(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_result_acknowledged ON lab_orders(result_acknowledged)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_snomed_concept ON lab_orders(snomed_concept_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_loinc_code ON lab_orders(loinc_code)`);
    
    // Add drugs table (medication catalog) - Enhanced with RxNorm, SNOMED, NDC, strength, unit, status
    statements.push(`CREATE TABLE IF NOT EXISTS drugs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), generic_name VARCHAR(255) NOT NULL, brand_names TEXT[], atc_code VARCHAR(20), rxnorm_code VARCHAR(20), rxnorm_name TEXT, rxnorm_tty VARCHAR(20), snomed_code VARCHAR(50), snomed_term TEXT, ndc_code VARCHAR(50), strength VARCHAR(100), unit VARCHAR(50), drug_class VARCHAR(100), active_ingredients TEXT[], dosage_forms TEXT[], route_of_administration TEXT[], description TEXT, is_active BOOLEAN DEFAULT true, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_atc_code ON drugs(atc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_status ON drugs(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_drug_class ON drugs(drug_class)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_is_active ON drugs(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_brand_names ON drugs USING GIN(brand_names)`);
    
    // Add drug_interactions table (many-to-many interactions)
    statements.push(`CREATE TABLE IF NOT EXISTS drug_interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), drug1_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, drug2_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')), description TEXT NOT NULL, mechanism TEXT, management TEXT, evidence_level VARCHAR(20), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(drug1_id, drug2_id))`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug1_id ON drug_interactions(drug1_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug2_id ON drug_interactions(drug2_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_severity ON drug_interactions(severity)`);
    
    // Add drug_id column to orders table (for linking prescriptions to drugs)
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL`);
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`);
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`);
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_codes JSONB DEFAULT '{}'::jsonb`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_orders_drug_id ON orders(drug_id) WHERE drug_id IS NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_orders_snomed_concept ON orders(snomed_concept_id)`);
    
    // Radiology & Medical Imaging Module
    // Imaging Modalities (X-Ray, CT, MRI, Ultrasound, etc.)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_modalities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_code VARCHAR(20) UNIQUE NOT NULL CHECK (modality_code IN ('XR','CT','MRI','US','MG','FL','NM','PET')), modality_name VARCHAR(100) NOT NULL, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_modality_code ON imaging_modalities(modality_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_is_active ON imaging_modalities(is_active)`);
    
    // Imaging Study Types (specific procedures)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_study_types (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_id UUID NOT NULL REFERENCES imaging_modalities(id) ON DELETE CASCADE, study_code VARCHAR(50) UNIQUE NOT NULL, study_name VARCHAR(255) NOT NULL, body_part VARCHAR(100), views TEXT[], typical_images INTEGER DEFAULT 1, contrast_required BOOLEAN DEFAULT false, cost DECIMAL(10,2), description TEXT, preparation_instructions TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_modality_id ON imaging_study_types(modality_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_study_code ON imaging_study_types(study_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_body_part ON imaging_study_types(body_part)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_is_active ON imaging_study_types(is_active)`);
    
    // Imaging Orders
    statements.push(`
      CREATE TABLE IF NOT EXISTS imaging_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        study_type_id UUID NOT NULL REFERENCES imaging_study_types(id),
        ordering_provider UUID NOT NULL REFERENCES users(id),
        clinical_indication TEXT,
        clinical_history TEXT,
        suspected_diagnosis TEXT,
        icd10_codes TEXT[],
        priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
        order_status VARCHAR(30) DEFAULT 'ordered' CHECK (order_status IN ('awaiting_payment','ordered','scheduled','in_progress','awaiting_report','completed','cancelled')),
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        snomed_module_id VARCHAR(50),
        snomed_definition_status VARCHAR(50),
        cpt_code VARCHAR(50),
        ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        scheduled_date TIMESTAMP WITH TIME ZONE,
        performed_at TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancellation_reason TEXT,
        fee_amount NUMERIC(12,2),
        finance_transaction_id UUID,
        payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient_id ON imaging_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_number ON imaging_orders(order_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_study_type_id ON imaging_orders(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordering_provider ON imaging_orders(ordering_provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_status ON imaging_orders(order_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_payment_status ON imaging_orders(payment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordered_at ON imaging_orders(ordered_at)`);
    statements.push(`ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`);
    statements.push(`ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`);
    statements.push(`ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_snomed_concept ON imaging_orders(snomed_concept_id)`);
    
    // Imaging Studies (actual imaging session)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_studies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, accession_number VARCHAR(50) UNIQUE NOT NULL, study_type_id UUID NOT NULL REFERENCES imaging_study_types(id), study_date DATE NOT NULL, study_time TIME NOT NULL, technologist UUID REFERENCES users(id), radiologist_assigned UUID REFERENCES users(id), study_status VARCHAR(30) DEFAULT 'in_progress' CHECK (study_status IN ('in_progress','awaiting_report','reported','signed','amended')), number_of_images INTEGER DEFAULT 0, study_description TEXT, technique TEXT, contrast_used BOOLEAN DEFAULT false, contrast_type VARCHAR(100), contrast_volume VARCHAR(50), radiation_dose VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_imaging_order_id ON imaging_studies(imaging_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_patient_id ON imaging_studies(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_accession_number ON imaging_studies(accession_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_type_id ON imaging_studies(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_radiologist_assigned ON imaging_studies(radiologist_assigned)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_status ON imaging_studies(study_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_date ON imaging_studies(study_date)`);
    
    // Imaging Files (images/DICOM files)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_files (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE, file_name VARCHAR(255) NOT NULL, file_path TEXT, file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('DICOM','JPEG','PNG','PDF','TIFF')), file_size BIGINT, image_number INTEGER, view_position VARCHAR(50), is_primary BOOLEAN DEFAULT false, uploaded_by UUID REFERENCES users(id), uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), object_key TEXT, content_type VARCHAR(100), storage_mode VARCHAR(10) DEFAULT 'db' CHECK (storage_mode IN ('db','object')), file_checksum VARCHAR(128))`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_imaging_study_id ON imaging_files(imaging_study_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_is_primary ON imaging_files(is_primary)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_uploaded_at ON imaging_files(uploaded_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_object_key ON imaging_files(object_key)`);
    statements.push(`ALTER TABLE imaging_files ALTER COLUMN file_path DROP NOT NULL`);
    
    // Imaging Reports
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE, imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, report_status VARCHAR(20) DEFAULT 'draft' CHECK (report_status IN ('draft','preliminary','final','amended')), clinical_history TEXT, technique TEXT, findings TEXT NOT NULL, impression TEXT NOT NULL, recommendations TEXT, comparison_studies TEXT, critical_findings TEXT, is_critical BOOLEAN DEFAULT false, structured_findings JSONB DEFAULT '{}'::jsonb, severity VARCHAR(20), follow_up_recommended BOOLEAN DEFAULT false, follow_up_interval VARCHAR(100), coded_diagnoses JSONB DEFAULT '[]'::jsonb, drafted_by UUID REFERENCES users(id), drafted_at TIMESTAMP WITH TIME ZONE, signed_by UUID REFERENCES users(id), signed_at TIMESTAMP WITH TIME ZONE, amended_by UUID REFERENCES users(id), amendment_reason TEXT, amended_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_imaging_study_id ON imaging_reports(imaging_study_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_patient_id ON imaging_reports(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_report_status ON imaging_reports(report_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_is_critical ON imaging_reports(is_critical)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_drafted_by ON imaging_reports(drafted_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_signed_by ON imaging_reports(signed_by)`);
    statements.push(`ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS structured_findings JSONB DEFAULT '{}'::jsonb`);
    statements.push(`ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS severity VARCHAR(20)`);
    statements.push(`ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS follow_up_recommended BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS follow_up_interval VARCHAR(100)`);
    statements.push(`ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS coded_diagnoses JSONB DEFAULT '[]'::jsonb`);
    
    // Imaging Report Acknowledgements (doctor review workflow)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_report_acknowledgements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_report_id UUID NOT NULL REFERENCES imaging_reports(id) ON DELETE CASCADE, doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), acknowledgment_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(imaging_report_id, doctor_id))`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_acknowledgements_report_id ON imaging_report_acknowledgements(imaging_report_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_acknowledgements_doctor_id ON imaging_report_acknowledgements(doctor_id)`);
    
    // Imaging Report Templates
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_report_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_id UUID REFERENCES imaging_modalities(id), study_type_id UUID REFERENCES imaging_study_types(id), template_name VARCHAR(255) NOT NULL, template_code VARCHAR(50) UNIQUE NOT NULL, technique_template TEXT, findings_template TEXT, impression_template TEXT, is_default BOOLEAN DEFAULT false, created_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_modality_id ON imaging_report_templates(modality_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_study_type_id ON imaging_report_templates(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_template_code ON imaging_report_templates(template_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_is_default ON imaging_report_templates(is_default)`);
    
    // Imaging Annotations (for image markup)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_annotations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_file_id UUID NOT NULL REFERENCES imaging_files(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id), annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('arrow','circle','rectangle','line','text','measurement','freehand')), annotation_data JSONB NOT NULL, annotation_text TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_imaging_file_id ON imaging_annotations(imaging_file_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_user_id ON imaging_annotations(user_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_annotation_type ON imaging_annotations(annotation_type)`);
    
    // Maternity & Obstetrics Module
    // Maternity Enrollments (Pregnancy Registration)
    statements.push(`CREATE TABLE IF NOT EXISTS maternity_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, enrollment_number VARCHAR(50) UNIQUE NOT NULL, enrollment_date DATE NOT NULL, expected_delivery_date DATE, edd_method VARCHAR(50) CHECK (edd_method IN ('LMP','Ultrasound','Clinical')), lmp_date DATE, gestational_age_at_enrollment INTEGER, gravida INTEGER, para INTEGER, parity_term INTEGER, parity_preterm INTEGER, parity_abortions INTEGER, parity_living INTEGER, previous_cesarean BOOLEAN DEFAULT false, previous_complications TEXT, previous_complications_snomed JSONB DEFAULT '[]'::jsonb, current_pregnancy_complications TEXT, current_complications_snomed JSONB DEFAULT '[]'::jsonb, risk_category VARCHAR(20) DEFAULT 'low' CHECK (risk_category IN ('low','medium','high')), enrollment_status VARCHAR(30) DEFAULT 'active' CHECK (enrollment_status IN ('active','delivered','transferred_out','pregnancy_loss')), enrolled_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_patient_id ON maternity_enrollments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_number ON maternity_enrollments(enrollment_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_status ON maternity_enrollments(enrollment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_risk_category ON maternity_enrollments(risk_category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_expected_delivery_date ON maternity_enrollments(expected_delivery_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_complications_snomed)`);
    
    // ANC Visits (WHO 8-visit model)
    statements.push(`CREATE TABLE IF NOT EXISTS anc_visits (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, visit_number INTEGER NOT NULL, visit_date DATE NOT NULL, gestational_age INTEGER, gestational_age_days INTEGER, weight DECIMAL(5,2), height DECIMAL(5,2), bmi DECIMAL(5,2), blood_pressure_systolic INTEGER, blood_pressure_diastolic INTEGER, temperature DECIMAL(4,2), pulse INTEGER, respiratory_rate INTEGER, fundal_height DECIMAL(4,1), fetal_heart_rate INTEGER, fetal_presentation VARCHAR(50), fetal_movement VARCHAR(50), edema VARCHAR(50), edema_location TEXT, proteinuria VARCHAR(50), glucose_urine VARCHAR(50), hemoglobin DECIMAL(4,1), blood_group VARCHAR(10), rhesus VARCHAR(10), vdrl_syphilis VARCHAR(20), hiv_status VARCHAR(20), hep_b_status VARCHAR(20), tetanus_immunization BOOLEAN, ipt_malaria INTEGER, iron_folate BOOLEAN, deworming BOOLEAN, insecticide_treated_net BOOLEAN, danger_signs_discussed BOOLEAN, birth_plan_discussed BOOLEAN, complications_identified TEXT, complications_snomed JSONB DEFAULT '[]'::jsonb, interventions TEXT, interventions_snomed JSONB DEFAULT '[]'::jsonb, referral_needed BOOLEAN, referral_reason TEXT, referral_reason_snomed_code VARCHAR(50), referral_reason_snomed_term TEXT, referral_reason_snomed_module_id VARCHAR(50), referral_reason_snomed_definition_status VARCHAR(50), referral_facility VARCHAR(255), next_visit_date DATE, provider UUID REFERENCES users(id), notes TEXT, vitals_source_vital_id UUID REFERENCES vitals(id), vitals_auto_populated_at TIMESTAMP WITH TIME ZONE, vitals_overridden BOOLEAN DEFAULT false, vitals_override_reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_maternity_enrollment_id ON anc_visits(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_patient_id ON anc_visits(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_visit_date ON anc_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_provider ON anc_visits(provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_vitals_source ON anc_visits(vitals_source_vital_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_next_visit_date ON anc_visits(next_visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code)`);
    
    // Ultrasound Scans
    statements.push(`CREATE TABLE IF NOT EXISTS ultrasound_scans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, scan_date DATE NOT NULL, gestational_age INTEGER, scan_type VARCHAR(50) CHECK (scan_type IN ('dating','anomaly','growth','biophysical','other')), number_of_fetuses INTEGER DEFAULT 1, fetal_viability BOOLEAN, fetal_heartbeat INTEGER, fetal_presentation VARCHAR(50), placenta_position VARCHAR(100), amniotic_fluid VARCHAR(50), afi DECIMAL(4,1), estimated_fetal_weight DECIMAL(6,2), biparietal_diameter DECIMAL(4,1), head_circumference DECIMAL(5,1), abdominal_circumference DECIMAL(5,1), femur_length DECIMAL(4,1), anomalies_detected TEXT, anomalies_snomed JSONB DEFAULT '[]'::jsonb, edd_by_ultrasound DATE, findings TEXT, findings_snomed JSONB DEFAULT '[]'::jsonb, performed_by UUID REFERENCES users(id), image_path TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_maternity_enrollment_id ON ultrasound_scans(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_patient_id ON ultrasound_scans(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_date ON ultrasound_scans(scan_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_type ON ultrasound_scans(scan_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed)`);
    
    // Deliveries
    statements.push(`CREATE TABLE IF NOT EXISTS deliveries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, delivery_date DATE NOT NULL, delivery_time TIME NOT NULL, gestational_age_at_delivery INTEGER, gestational_age_days INTEGER, admission_date TIMESTAMP WITH TIME ZONE, delivery_type VARCHAR(50) CHECK (delivery_type IN ('spontaneous_vaginal','assisted_vaginal','cesarean','instrumental')), delivery_method VARCHAR(100), indication_for_intervention TEXT, indication_snomed_code VARCHAR(50), indication_snomed_term TEXT, indication_snomed_module_id VARCHAR(50), indication_snomed_definition_status VARCHAR(50), labor_onset VARCHAR(50), induction_method VARCHAR(100), duration_of_labor_hours DECIMAL(4,1), rupture_of_membranes TIMESTAMP WITH TIME ZONE, membrane_rupture_type VARCHAR(50), anesthesia_type VARCHAR(50), episiotomy BOOLEAN, perineal_tear_degree VARCHAR(20), blood_loss DECIMAL(6,1), placenta_delivery VARCHAR(50), placenta_complete BOOLEAN, maternal_complications TEXT, maternal_complications_snomed JSONB DEFAULT '[]'::jsonb, maternal_outcome VARCHAR(50), attending_provider UUID REFERENCES users(id), assistant_provider UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_maternity_enrollment_id ON deliveries(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_patient_id ON deliveries(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_type ON deliveries(delivery_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_attending_provider ON deliveries(attending_provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed)`);
    
    // Birth Outcomes
    statements.push(`CREATE TABLE IF NOT EXISTS birth_outcomes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, birth_order INTEGER DEFAULT 1, birth_outcome VARCHAR(50) CHECK (birth_outcome IN ('live_birth','stillbirth','neonatal_death')), sex VARCHAR(20), birth_weight DECIMAL(5,2), birth_length DECIMAL(4,1), head_circumference DECIMAL(4,1), apgar_1min INTEGER, apgar_5min INTEGER, apgar_10min INTEGER, resuscitation_required BOOLEAN, resuscitation_type TEXT, congenital_anomalies TEXT, congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb, neonatal_complications TEXT, neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb, breastfeeding_initiated BOOLEAN, breastfeeding_within_1hour BOOLEAN, vitamin_k_given BOOLEAN, eye_prophylaxis_given BOOLEAN, newborn_outcome VARCHAR(50), time_of_death TIMESTAMP WITH TIME ZONE, cause_of_death TEXT, cause_of_death_snomed_code VARCHAR(50), cause_of_death_snomed_term TEXT, cause_of_death_snomed_module_id VARCHAR(50), cause_of_death_snomed_definition_status VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_delivery_id ON birth_outcomes(delivery_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_birth_outcome ON birth_outcomes(birth_outcome)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code)`);
    
    // Postnatal Visits
    statements.push(`CREATE TABLE IF NOT EXISTS postnatal_visits (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, delivery_id UUID REFERENCES deliveries(id), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, visit_date DATE NOT NULL, days_postpartum INTEGER, weight DECIMAL(5,2), blood_pressure_systolic INTEGER, blood_pressure_diastolic INTEGER, temperature DECIMAL(4,2), pulse INTEGER, general_condition VARCHAR(50), uterine_involution VARCHAR(50), lochia VARCHAR(50), perineum_condition VARCHAR(50), breast_condition VARCHAR(50), breastfeeding_status VARCHAR(50), breastfeeding_problems TEXT, emotional_status VARCHAR(50), danger_signs TEXT, danger_signs_snomed JSONB DEFAULT '[]'::jsonb, family_planning_discussed BOOLEAN, family_planning_method VARCHAR(100), family_planning_method_snomed_code VARCHAR(50), family_planning_method_snomed_term TEXT, family_planning_method_snomed_module_id VARCHAR(50), family_planning_method_snomed_definition_status VARCHAR(50), newborn_status VARCHAR(50), newborn_complications TEXT, newborn_complications_snomed JSONB DEFAULT '[]'::jsonb, provider UUID REFERENCES users(id), notes TEXT, next_visit_date DATE, vitals_source_vital_id UUID REFERENCES vitals(id), vitals_auto_populated_at TIMESTAMP WITH TIME ZONE, vitals_overridden BOOLEAN DEFAULT false, vitals_override_reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_maternity_enrollment_id ON postnatal_visits(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_patient_id ON postnatal_visits(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_visit_date ON postnatal_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_provider ON postnatal_visits(provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_vitals_source ON postnatal_visits(vitals_source_vital_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code)`);
    
    // Maternity Risk Factors
    statements.push(`CREATE TABLE IF NOT EXISTS maternity_risk_factors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, risk_factor VARCHAR(100) NOT NULL, risk_category VARCHAR(20) CHECK (risk_category IN ('medical','obstetric','social')), severity VARCHAR(20) CHECK (severity IN ('low','medium','high')), identified_date DATE NOT NULL, resolved_date DATE, notes TEXT, created_by UUID REFERENCES users(id), risk_factor_snomed_code VARCHAR(50), risk_factor_snomed_term TEXT, risk_factor_snomed_module_id VARCHAR(50), risk_factor_snomed_definition_status VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_maternity_enrollment_id ON maternity_risk_factors(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_risk_category ON maternity_risk_factors(risk_category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_severity ON maternity_risk_factors(severity)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code)`);
    statements.push(...this.getMaternityCareTaskSchemaStatements());

    // HIV/AIDS/TB/Cervical Cancer Tables
    // HIV Test Results Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS hiv_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        test_number VARCHAR(100) UNIQUE NOT NULL,
        test_date TIMESTAMP WITH TIME ZONE NOT NULL,
        test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('rapid_antibody','elisa','pcr','viral_load','cd4')),
        test_stage VARCHAR(50) DEFAULT 'screening' CHECK (test_stage IN ('screening','confirmatory','tie_breaker','retest_before_art','self_test_verification','recency')),
        testing_reason VARCHAR(100),
        testing_approach VARCHAR(50) CHECK (testing_approach IN ('facility','community','self_test','provider_initiated','client_initiated','lay_provider','pharmacy')),
        testing_location VARCHAR(100),
        testing_cadre VARCHAR(100),
        specimen_type VARCHAR(50),
        test_snomed_code VARCHAR(50),
        test_snomed_term TEXT,
        test_snomed_module_id VARCHAR(50),
        test_snomed_definition_status VARCHAR(50),
        specimen_snomed_code VARCHAR(50),
        specimen_snomed_term TEXT,
        kit_type VARCHAR(100),
        test_kit_name VARCHAR(100),
        test_kit_lot VARCHAR(100),
        test_kit_expiry DATE,
        dual_kit_used BOOLEAN DEFAULT false,
        test_result VARCHAR(50) NOT NULL CHECK (test_result IN ('reactive','non_reactive','invalid','indeterminate','positive','negative','pending')),
        result_value VARCHAR(255),
        result_unit VARCHAR(50),
        is_confirmatory BOOLEAN DEFAULT false,
        confirmatory_test_id UUID REFERENCES hiv_tests(id),
        testing_algorithm_step INTEGER DEFAULT 1,
        algorithm_result VARCHAR(50) CHECK (algorithm_result IN ('positive','negative','indeterminate','incomplete')),
        self_test_reported BOOLEAN DEFAULT false,
        self_test_confirmed BOOLEAN DEFAULT false,
        recency_test_performed BOOLEAN DEFAULT false,
        recency_result VARCHAR(50),
        recency_kit_lot VARCHAR(100),
        recency_kit_expiry DATE,
        partner_notification_status VARCHAR(50),
        linkage_action VARCHAR(100),
        linkage_completed BOOLEAN DEFAULT false,
        stis_screened JSONB DEFAULT '[]'::jsonb,
        stis_results JSONB DEFAULT '[]'::jsonb,
        follow_up_actions JSONB DEFAULT '[]'::jsonb,
        testing_context JSONB DEFAULT '{}'::jsonb,
        next_test_due_date DATE,
        tested_by UUID NOT NULL REFERENCES users(id),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        enrolled_in_care BOOLEAN DEFAULT false,
        enrollment_declined BOOLEAN DEFAULT false,
        enrollment_declined_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_term TEXT`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_term TEXT`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_stage VARCHAR(50) DEFAULT 'screening'`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_reason VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_approach VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_location VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_cadre VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_type VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS kit_type VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS dual_kit_used BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS self_test_reported BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS self_test_confirmed BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_test_performed BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_result VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_kit_lot VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_kit_expiry DATE`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS partner_notification_status VARCHAR(50)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS linkage_action VARCHAR(100)`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS linkage_completed BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS stis_screened JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS stis_results JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS follow_up_actions JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_context JSONB DEFAULT '{}'::jsonb`);
    statements.push(`ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS next_test_due_date DATE`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_patient_id ON hiv_tests(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_date ON hiv_tests(test_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_result ON hiv_tests(test_result)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_enrolled_in_care ON hiv_tests(enrolled_in_care)`);
    statements.push(`
      CREATE TABLE IF NOT EXISTS sti_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        hiv_test_id UUID REFERENCES hiv_tests(id) ON DELETE SET NULL,
        test_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        infection_type VARCHAR(50) NOT NULL,
        test_type VARCHAR(100),
        test_method VARCHAR(100),
        specimen_type VARCHAR(100),
        anatomic_site VARCHAR(100),
        result VARCHAR(50) CHECK (result IN ('positive','negative','reactive','non_reactive','indeterminate','pending','invalid')),
        result_value VARCHAR(255),
        result_unit VARCHAR(50),
        treatment_provided BOOLEAN DEFAULT false,
        treatment_regimen TEXT,
        treatment_date DATE,
        notes TEXT,
        ordered_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sti_tests_patient_id ON sti_tests(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sti_tests_infection_type ON sti_tests(infection_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sti_tests_result ON sti_tests(result)`);
    
    // Oncology module
    statements.push(`
      CREATE TABLE IF NOT EXISTS oncology_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        primary_diagnosis VARCHAR(255) NOT NULL,
        primary_diagnosis_snomed_code VARCHAR(50),
        primary_diagnosis_snomed_term TEXT,
        primary_diagnosis_snomed_module_id VARCHAR(50),
        primary_diagnosis_snomed_definition_status VARCHAR(50),
        staging_system VARCHAR(50),
        overall_stage VARCHAR(20),
        stage_at_diagnosis VARCHAR(20),
        diagnosis_date DATE,
        primary_site VARCHAR(100),
        histology VARCHAR(100),
        oncologist_id UUID REFERENCES users(id),
        status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','in_remission','completed_therapy','follow_up','deceased','transferred_out')),
        care_plan TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_cases_patient_id ON oncology_cases(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_cases_status ON oncology_cases(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_cases_primary_dx_snomed ON oncology_cases(primary_diagnosis_snomed_code)`);
    statements.push(`ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_term TEXT`);
    statements.push(`ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_definition_status VARCHAR(50)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS oncology_staging_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE, staging_system VARCHAR(50) NOT NULL, t_stage VARCHAR(10), n_stage VARCHAR(10), m_stage VARCHAR(10), overall_stage VARCHAR(20), stage_date DATE NOT NULL, performance_status VARCHAR(20), notes TEXT, recorded_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_staging_case_id ON oncology_staging_entries(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_staging_stage_date ON oncology_staging_entries(stage_date)`);
    
    statements.push(`
      CREATE TABLE IF NOT EXISTS oncology_regimens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
        regimen_name VARCHAR(255) NOT NULL,
        regimen_snomed_code VARCHAR(50),
        regimen_snomed_term TEXT,
        regimen_snomed_module_id VARCHAR(50),
        regimen_snomed_definition_status VARCHAR(50),
        line_of_therapy VARCHAR(50),
        intent VARCHAR(50) CHECK (intent IN ('curative','adjuvant','neoadjuvant','palliative','maintenance','other')),
        cycles_planned INTEGER,
        start_date DATE,
        end_date DATE,
        status VARCHAR(30) DEFAULT 'planned' CHECK (status IN ('planned','active','completed','paused','cancelled')),
        regimen_details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_regimens_case_id ON oncology_regimens(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_regimens_status ON oncology_regimens(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_regimens_snomed ON oncology_regimens(regimen_snomed_code)`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_term TEXT`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS cycle_length_days INTEGER`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 0`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS last_cycle_date DATE`);
    statements.push(`ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS next_cycle_date DATE`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS oncology_infusion_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), regimen_id UUID NOT NULL REFERENCES oncology_regimens(id) ON DELETE CASCADE, cycle_number INTEGER, session_date TIMESTAMP WITH TIME ZONE NOT NULL, location VARCHAR(100), administered_by UUID REFERENCES users(id), vitals JSONB DEFAULT '{}'::jsonb, drugs_administered JSONB DEFAULT '[]'::jsonb, premedications JSONB DEFAULT '[]'::jsonb, toxicities JSONB DEFAULT '[]'::jsonb, status VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled')), notes TEXT, fee_amount NUMERIC(12,2), finance_transaction_id UUID, payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_infusion_regimen_id ON oncology_infusion_sessions(regimen_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_infusion_session_date ON oncology_infusion_sessions(session_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_infusion_payment_status ON oncology_infusion_sessions(payment_status)`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2)`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS finance_transaction_id UUID`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'payment_confirmed'`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(30)`);
    statements.push(`ALTER TABLE oncology_infusion_sessions DROP CONSTRAINT IF EXISTS oncology_infusion_sessions_status_check`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD CONSTRAINT oncology_infusion_sessions_status_check CHECK (status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled'))`);
    statements.push(`ALTER TABLE oncology_infusion_sessions DROP CONSTRAINT IF EXISTS oncology_infusion_sessions_payment_status_check`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD CONSTRAINT oncology_infusion_sessions_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'))`);
    
    statements.push(`
      CREATE TABLE IF NOT EXISTS oncology_adverse_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
        regimen_id UUID REFERENCES oncology_regimens(id) ON DELETE SET NULL,
        event_date TIMESTAMP WITH TIME ZONE NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        event_snomed_code VARCHAR(50),
        event_snomed_term TEXT,
        event_snomed_module_id VARCHAR(50),
        event_snomed_definition_status VARCHAR(50),
        grade VARCHAR(10),
        related_to VARCHAR(50),
        action_taken TEXT,
        outcome VARCHAR(100),
        resolved_date DATE,
        notes TEXT,
        reported_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_case_id ON oncology_adverse_events(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_event_date ON oncology_adverse_events(event_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_snomed ON oncology_adverse_events(event_snomed_code)`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_term TEXT`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS severity_grade INTEGER`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
    statements.push(`ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS tumor_board_meetings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_date TIMESTAMP WITH TIME ZONE NOT NULL, facilitator UUID REFERENCES users(id), location VARCHAR(100), agenda TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tumor_board_meetings_date ON tumor_board_meetings(meeting_date)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS tumor_board_recommendations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL REFERENCES tumor_board_meetings(id) ON DELETE CASCADE, oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE, recommendation TEXT NOT NULL, follow_up_actions TEXT, responsible_team VARCHAR(100), due_date DATE, status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','declined')), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_meeting_id ON tumor_board_recommendations(meeting_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_case_id ON tumor_board_recommendations(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_status ON tumor_board_recommendations(status)`);
    
    // Ophthalmology module
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_encounters (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, encounter_date TIMESTAMP WITH TIME ZONE NOT NULL, encounter_type VARCHAR(50) CHECK (encounter_type IN ('comprehensive_exam','follow_up','pre_op','post_op','emergency','other')), ophthalmologist_id UUID REFERENCES users(id), chief_complaint TEXT, assessment TEXT, plan TEXT, fee_amount NUMERIC(12,2), finance_transaction_id UUID, payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_patient_id ON ophthalmology_encounters(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_date ON ophthalmology_encounters(encounter_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_payment_status ON ophthalmology_encounters(payment_status)`);
    statements.push(`ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2)`);
    statements.push(`ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS finance_transaction_id UUID`);
    statements.push(`ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'payment_confirmed'`);
    statements.push(`ALTER TABLE ophthalmology_encounters DROP CONSTRAINT IF EXISTS ophthalmology_encounters_payment_status_check`);
    statements.push(`ALTER TABLE ophthalmology_encounters ADD CONSTRAINT ophthalmology_encounters_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'))`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_visual_acuity (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE, eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')), distance_unaided VARCHAR(20), distance_aided VARCHAR(20), near_unaided VARCHAR(20), near_aided VARCHAR(20), pinhole VARCHAR(20), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_visual_acuity_encounter_id ON ophthalmology_visual_acuity(encounter_id)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_refraction (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE, eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')), sphere NUMERIC(5,2), cylinder NUMERIC(5,2), axis INTEGER, add_power NUMERIC(5,2), corrected_va VARCHAR(20), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_refraction_encounter_id ON ophthalmology_refraction(encounter_id)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_slit_lamp_findings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE, structure VARCHAR(100) NOT NULL, observation TEXT NOT NULL, severity VARCHAR(20), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_slit_lamp_encounter_id ON ophthalmology_slit_lamp_findings(encounter_id)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_oct_studies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE, imaging_order_id UUID REFERENCES imaging_orders(id), eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')), study_date TIMESTAMP WITH TIME ZONE, image_reference TEXT, interpretation TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_oct_encounter_id ON ophthalmology_oct_studies(encounter_id)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_procedures (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, encounter_id UUID REFERENCES ophthalmology_encounters(id) ON DELETE SET NULL, procedure_name VARCHAR(255) NOT NULL, procedure_date DATE NOT NULL, eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')), outcome TEXT, complications TEXT, surgeon_id UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_procedures_patient_id ON ophthalmology_procedures(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_procedures_date ON ophthalmology_procedures(procedure_date)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS ophthalmology_follow_ups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL, reason TEXT, priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('urgent','routine','low')), status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')), related_encounter_id UUID REFERENCES ophthalmology_encounters(id) ON DELETE SET NULL, reminders_sent JSONB DEFAULT '[]'::jsonb, created_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_patient_id ON ophthalmology_follow_ups(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_status ON ophthalmology_follow_ups(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_scheduled_date ON ophthalmology_follow_ups(scheduled_date)`);
    
    // HIV Care Enrollment Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_care_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, enrollment_date DATE NOT NULL, enrollment_number VARCHAR(100) UNIQUE NOT NULL, enrollment_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'transferred_out', 'lost_to_followup', 'deceased', 'discontinued')), enrollment_facility VARCHAR(255), previous_care_facility VARCHAR(255), previous_care_number VARCHAR(100), date_confirmed_positive DATE, art_start_date DATE, baseline_cd4 INTEGER, baseline_viral_load DECIMAL(10,2), baseline_viral_load_unit VARCHAR(10) DEFAULT 'copies/mL', baseline_clinical_stage VARCHAR(20) CHECK (baseline_clinical_stage IN ('stage1', 'stage2', 'stage3', 'stage4')), baseline_who_stage VARCHAR(20), current_regimen VARCHAR(255), transfer_out_date DATE, transfer_out_facility VARCHAR(255), loss_to_followup_date DATE, loss_to_followup_reason TEXT, deceased_date DATE, cause_of_death TEXT, discontinued_date DATE, discontinued_reason TEXT, enrollment_notes TEXT, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_patient_id ON hiv_care_enrollments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_status ON hiv_care_enrollments(enrollment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_number ON hiv_care_enrollments(enrollment_number)`);
    
    // HIV ART Initiation Details Table - Captures comprehensive registration/initiation data
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_initiation_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      
      -- OI/ART Number
      oi_art_number VARCHAR(100) UNIQUE,
      
      -- Registration Details
      date_of_registration DATE NOT NULL,
      name_of_registration_health_centre VARCHAR(255),
      age_at_registration INTEGER,
      sex_assigned_at_birth VARCHAR(10) CHECK (sex_assigned_at_birth IN ('Male', 'Female')),
      
      -- Marital Status (multiple checkboxes allowed)
      marital_status_married BOOLEAN DEFAULT false,
      marital_status_never_married BOOLEAN DEFAULT false,
      marital_status_widowed BOOLEAN DEFAULT false,
      marital_status_divorced_separated BOOLEAN DEFAULT false,
      marital_status_living_together BOOLEAN DEFAULT false,
      marital_status_minor BOOLEAN DEFAULT false,
      
      -- Patient Profile (multiple checkboxes allowed)
      patient_profile_general_population BOOLEAN DEFAULT false,
      patient_profile_sex_worker BOOLEAN DEFAULT false,
      patient_profile_msm BOOLEAN DEFAULT false,
      patient_profile_wsw BOOLEAN DEFAULT false,
      patient_profile_pwud BOOLEAN DEFAULT false,
      patient_profile_pwid BOOLEAN DEFAULT false,
      patient_profile_transgender BOOLEAN DEFAULT false,
      patient_profile_others BOOLEAN DEFAULT false,
      patient_profile_others_details VARCHAR(255),
      
      -- Education Level (single selection)
      education_level VARCHAR(20) CHECK (education_level IN ('None', 'Primary', 'Secondary', 'Tertiary')),
      
      -- Contact Information
      physical_address TEXT,
      kraal VARCHAR(255),
      village VARCHAR(255),
      school VARCHAR(255),
      clinic VARCHAR(255),
      telephone VARCHAR(50),
      cellphone VARCHAR(50),
      work_address TEXT,
      work_telephone VARCHAR(50),
      occupation VARCHAR(255),
      
      -- Next of Kin
      next_of_kin_name VARCHAR(255),
      
      -- Linkage Information (multiple checkboxes allowed)
      linkage_from_eid BOOLEAN DEFAULT false,
      linkage_from_hts BOOLEAN DEFAULT false,
      linkage_from_pmtct BOOLEAN DEFAULT false,
      linkage_from_sti BOOLEAN DEFAULT false,
      linkage_from_tb_program BOOLEAN DEFAULT false,
      linkage_from_vmmc BOOLEAN DEFAULT false,
      linkage_from_other BOOLEAN DEFAULT false,
      linkage_from_other_details VARCHAR(255),
      
      -- Orphan Status (for patients <18 years)
      orphan_status_double BOOLEAN DEFAULT false,
      orphan_status_single BOOLEAN DEFAULT false,
      orphan_status_not_orphan BOOLEAN DEFAULT false,
      
      -- HIV Test Details
      date_first_confirmed_hiv_test DATE,
      institution_name_vct_pmtct VARCHAR(255),
      hiv_test_used_antibody BOOLEAN DEFAULT false,
      hiv_test_used_pcr BOOLEAN DEFAULT false,
      
      -- Reason for HIV Test (multiple checkboxes allowed)
      reason_hiv_test_antenatal BOOLEAN DEFAULT false,
      reason_hiv_test_pep BOOLEAN DEFAULT false,
      reason_hiv_test_death_child_spouse BOOLEAN DEFAULT false,
      reason_hiv_test_prep BOOLEAN DEFAULT false,
      reason_hiv_test_hospital_illness BOOLEAN DEFAULT false,
      reason_hiv_test_spouse_child_lt5_art BOOLEAN DEFAULT false,
      reason_hiv_test_occupational BOOLEAN DEFAULT false,
      reason_hiv_test_tb BOOLEAN DEFAULT false,
      reason_hiv_test_vct BOOLEAN DEFAULT false,
      reason_hiv_test_others BOOLEAN DEFAULT false,
      reason_hiv_test_others_details VARCHAR(255),
      
      -- Confirmatory and Retesting
      confirmatory_hiv_test BOOLEAN DEFAULT false,
      retesting_hiv_for_art_initiation BOOLEAN DEFAULT false,
      
      -- Medical Insurance
      medical_insurance_scheme_name VARCHAR(255),
      medical_insurance_policy_number VARCHAR(100),
      medical_insurance_member_name VARCHAR(255),
      medical_insurance_relationship_to_member VARCHAR(100),
      
      -- Consent/Assent
      consent_personal_tracing BOOLEAN DEFAULT false,
      consent_personal_tracing_date DATE,
      consent_index_case_testing BOOLEAN DEFAULT false,
      consent_index_case_testing_date DATE,
      disclosure_hiv_status VARCHAR(10) CHECK (disclosure_hiv_status IN ('Yes', 'No')),
      disclosure_hiv_status_to_whom VARCHAR(255),
      disclosure_hiv_status_final_date DATE,
      disclosure_hiv_status_final_to_whom VARCHAR(255),
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_patient_id ON hiv_art_initiation_details(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_enrollment_id ON hiv_art_initiation_details(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_oi_art_number ON hiv_art_initiation_details(oi_art_number)`);
    
    // HIV Clinical Visits Table - Enhanced with comprehensive data points
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_clinical_visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_number INTEGER,
      visit_date DATE NOT NULL,
      visit_type VARCHAR(10) NOT NULL CHECK (visit_type IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
      provider_id UUID NOT NULL REFERENCES users(id),
      provider_role VARCHAR(50),
      visit_reason_snomed_code VARCHAR(50),
      visit_reason_snomed_term TEXT,
      visit_reason_snomed_module_id VARCHAR(50),
      visit_reason_snomed_definition_status VARCHAR(50),
      
      -- Vital Signs
      weight_kg DECIMAL(5,2),
      height_cm DECIMAL(5,2),
      bmi DECIMAL(4,2),
      blood_pressure VARCHAR(20),
      
      -- Reproductive Health
      pregnancy_lactating_status VARCHAR(10) CHECK (pregnancy_lactating_status IN ('P', 'L', 'NPL', 'N/A')),
      first_anc_booking_date DATE,
      delivery_date DATE,
      family_planning_status TEXT[],
      
      -- Clinical Status
      functional_status VARCHAR(10) CHECK (functional_status IN ('W', 'A', 'B')),
      who_clinical_stage INTEGER CHECK (who_clinical_stage IN (1, 2, 3, 4)),
      opportunistic_infections TEXT[],
      opportunistic_infections_snomed JSONB DEFAULT '[]'::jsonb,
      
      -- TB Status
      tb_screening VARCHAR(10) CHECK (tb_screening IN ('Y', 'S', 'ON', 'N')),
      tb_investigation_result VARCHAR(10) CHECK (tb_investigation_result IN ('1', '2', '3', '4', '5')),
      tb_screening_snomed_code VARCHAR(50),
      tb_screening_snomed_term TEXT,
      tb_screening_snomed_module_id VARCHAR(50),
      tb_screening_snomed_definition_status VARCHAR(50),
      tb_investigation_snomed JSONB DEFAULT '[]'::jsonb,
      tb_diagnosed BOOLEAN DEFAULT false,
      tb_diagnosis_date DATE,
      tb_treatment_started BOOLEAN DEFAULT false,
      
      -- TPT (Tuberculosis Preventive Therapy)
      ipt_eligibility VARCHAR(1) CHECK (ipt_eligibility IN ('Y', 'N')),
      tpt_status VARCHAR(10) CHECK (tpt_status IN ('II', 'CI', 'RI', 'IS', 'HPI', 'IC', 'INI', 'NE', 'N/A')),
      tpt_not_started_stopped_reason VARCHAR(10),
      tpt_quantity_dispensed INTEGER,
      tpt_adherence_percentage INTEGER CHECK (tpt_adherence_percentage >= 0 AND tpt_adherence_percentage <= 100),
      
      -- Prophylaxis
      cotrimoxazole_quantity_dispensed INTEGER,
      cotrimoxazole_adherence_percentage INTEGER CHECK (cotrimoxazole_adherence_percentage >= 0 AND cotrimoxazole_adherence_percentage <= 100),
      fluconazole_quantity_prescribed INTEGER,
      fluconazole_quantity_dispensed INTEGER,
      
      -- ARV Status & Regimens
      arv_status VARCHAR(10) CHECK (arv_status IN ('1', '2', '2a', '2b', '3', '4', '5', '6', '7')),
      arv_reason VARCHAR(10),
      arv_reason_snomed_code VARCHAR(50),
      arv_reason_snomed_term TEXT,
      arv_regimen_code VARCHAR(10),
      arv_regimen_name VARCHAR(255),
      arv_regimen_snomed_code VARCHAR(50),
      arv_regimen_snomed_term TEXT,
      arv_regimen_snomed_module_id VARCHAR(50),
      arv_regimen_snomed_definition_status VARCHAR(50),
      arv_quantity_prescribed INTEGER,
      arv_quantity_dispensed INTEGER,
      arv_adherence_percentage INTEGER CHECK (arv_adherence_percentage >= 0 AND arv_adherence_percentage <= 100),
      regimen_changed BOOLEAN DEFAULT false,
      regimen_change_approved_by UUID REFERENCES users(id),
      regimen_change_approved_at TIMESTAMP WITH TIME ZONE,
      
      -- Lab Results
      cd4_count INTEGER,
      cd4_percentage DECIMAL(5,2),
      cd4_test_date DATE,
      viral_load DECIMAL(10,2),
      viral_load_unit VARCHAR(10) DEFAULT 'copies/mL',
      viral_load_sample_collected_date DATE,
      viral_load_result_received_date DATE,
      viral_load_test_date DATE,
      viral_load_suppressed BOOLEAN,
      alt_result DECIMAL(10,2),
      creatinine_result DECIMAL(10,2),
      other_diagnostics TEXT,
      
      -- Cryptococcal Status
      cryptococcal_signs_code VARCHAR(10),
      cryptococcal_status_code VARCHAR(10),
      cryptococcal_csf_investigation_done BOOLEAN DEFAULT false,
      cryptococcal_preemptive_treatment_result BOOLEAN,
      cryptococcal_treatment_code VARCHAR(10),
      
      -- Cervical Cancer Screening
      cervical_cancer_hpv_test_result VARCHAR(10) CHECK (cervical_cancer_hpv_test_result IN ('Pos', 'Neg', 'Pending')),
      cervical_cancer_viac_result VARCHAR(10) CHECK (cervical_cancer_viac_result IN ('Pos', 'Neg', 'Pending')),
      cervical_cancer_treatment_code VARCHAR(10),
      
      -- Mental Health
      mental_health_result_code VARCHAR(10),
      mental_health_result_snomed_code VARCHAR(50),
      mental_health_result_snomed_term TEXT,
      mental_health_management_code VARCHAR(10),
      mental_health_management_snomed_code VARCHAR(50),
      mental_health_management_snomed_term TEXT,
      
      -- TB Investigation Details
      tb_investigation_xpert_mtb_rif VARCHAR(50),
      tb_investigation_ultra_lf_lam VARCHAR(50),
      tb_investigation_tst_children VARCHAR(50),
      
      -- ARV Initiation Category
      arv_initiation_category_code VARCHAR(20),
      
      -- ARV Medicine Details
      arv_duration_prescribed VARCHAR(100),
      arv_reason_not_on_code VARCHAR(10),
      arv_reason_start_code VARCHAR(10),
      arv_change_stop_reason_code VARCHAR(10),
      
      -- Adverse Events
      adverse_events_status VARCHAR(50)[],
      adverse_events_snomed JSONB DEFAULT '[]'::jsonb,
      
      -- Referrals & Follow-up
      referred_to VARCHAR(10),
      referred_to_details TEXT,
      referral_reason_snomed_code VARCHAR(50),
      referral_reason_snomed_term TEXT,
      next_review_date DATE,
      visit_status VARCHAR(10) CHECK (visit_status IN ('E', 'OT', 'L', 'D', 'LO')),
      follow_up_status VARCHAR(10) CHECK (follow_up_status IN ('Tx', 'Miss', 'LTFU', 'TO', 'D', 'OO', 'O')),
      follow_up_details TEXT,
      follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb,
      
      -- Notes & Tracking
      visit_notes TEXT,
      clinician_initials VARCHAR(50),
      pharmacy_dispenser_initials VARCHAR(50),
      
      -- Legacy fields (for backward compatibility)
      visit_type_legacy VARCHAR(50),
      cd4_count_legacy INTEGER,
      viral_load_legacy DECIMAL(10,2),
      viral_load_unit_legacy VARCHAR(10),
      viral_load_suppressed_legacy BOOLEAN,
      weight_legacy DECIMAL(5,2),
      height_legacy DECIMAL(5,2),
      bmi_legacy DECIMAL(4,2),
      blood_pressure_legacy VARCHAR(20),
      adherence_percentage_legacy INTEGER,
      side_effects_legacy TEXT[],
      opportunistic_infections_legacy TEXT[],
      tb_symptoms_legacy VARCHAR(50),
      tb_screened_legacy BOOLEAN,
      tb_screened_result_legacy VARCHAR(50),
      pregnancy_status_legacy VARCHAR(50),
      gestational_age_weeks_legacy INTEGER,
      oi_prophylaxis_legacy TEXT,
      current_regimen_legacy VARCHAR(255),
      regimen_changed_legacy BOOLEAN,
      regimen_change_reason_legacy TEXT,
      next_appointment_date_legacy DATE,
      visit_notes_legacy TEXT,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_enrollment_id ON hiv_clinical_visits(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_visit_date ON hiv_clinical_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_provider_id ON hiv_clinical_visits(provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_viral_load ON hiv_clinical_visits(viral_load)`);
    
    // Enhanced Adherence Counseling (EAC) Table - WHO Guidelines
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_eac_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      session_number INTEGER NOT NULL,
      session_date DATE NOT NULL,
      counselor_id UUID NOT NULL REFERENCES users(id),
      counselor_name VARCHAR(255),
      
      -- Adherence Assessment
      adherence_barriers TEXT[],
      adherence_barriers_snomed JSONB DEFAULT '[]'::jsonb,
      barriers_other_details TEXT,
      adherence_percentage_self_reported INTEGER CHECK (adherence_percentage_self_reported >= 0 AND adherence_percentage_self_reported <= 100),
      adherence_assessment_method VARCHAR(50),
      
      -- Interventions
      interventions_provided TEXT[],
      interventions_snomed JSONB DEFAULT '[]'::jsonb,
      interventions_other_details TEXT,
      medication_simplification BOOLEAN DEFAULT false,
      adherence_tools_provided TEXT[],
      adherence_tools_snomed JSONB DEFAULT '[]'::jsonb,
      support_systems_identified TEXT[],
      support_systems_snomed JSONB DEFAULT '[]'::jsonb,
      
      -- Patient Feedback
      patient_feedback TEXT,
      patient_concerns TEXT,
      patient_commitment_level VARCHAR(20) CHECK (patient_commitment_level IN ('High', 'Medium', 'Low')),
      
      -- Follow-up Plan
      next_session_date DATE,
      follow_up_actions TEXT[],
      follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb,
      follow_up_responsible_person VARCHAR(255),
      
      -- Outcome Assessment
      session_outcome VARCHAR(50) CHECK (session_outcome IN ('Completed', 'Partial', 'Missed', 'Rescheduled')),
      session_outcome_snomed_code VARCHAR(50),
      session_outcome_snomed_term TEXT,
      outcome_notes TEXT,
      adherence_improvement_observed BOOLEAN DEFAULT false,
      
      -- EAC Program Status
      eac_program_status VARCHAR(50) CHECK (eac_program_status IN ('Active', 'Completed', 'Discontinued', 'Returned to Care')),
      eac_completion_date DATE,
      return_to_conventional_care_date DATE,
      
      -- Viral Load Monitoring During EAC (WHO Guidelines)
      viral_load DECIMAL(10,2),
      viral_load_unit VARCHAR(10) DEFAULT 'copies/mL',
      viral_load_test_date DATE,
      viral_load_suppressed BOOLEAN,
      viral_load_improved BOOLEAN DEFAULT false,
      
      session_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      UNIQUE(enrollment_id, session_number)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_enrollment_id ON hiv_eac_sessions(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_session_date ON hiv_eac_sessions(session_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_program_status ON hiv_eac_sessions(eac_program_status)`);
    
    // Referral Management Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
      referral_type VARCHAR(10) NOT NULL CHECK (referral_type IN ('P', 'T', 'F', 'D', 'H', 'O')),
      referral_type_details TEXT,
      referred_to_facility VARCHAR(255),
      referred_to_provider VARCHAR(255),
      referral_reason TEXT NOT NULL,
      referral_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending', 'in_progress', 'completed', 'declined', 'cancelled')),
      referral_priority VARCHAR(20) DEFAULT 'normal' CHECK (referral_priority IN ('urgent', 'high', 'normal', 'low')),
      referred_by UUID NOT NULL REFERENCES users(id),
      referred_by_name VARCHAR(255),
      completed_date DATE,
      completed_by UUID REFERENCES users(id),
      outcome TEXT,
      outcome_notes TEXT,
      follow_up_required BOOLEAN DEFAULT false,
      follow_up_date DATE,
      declined_reason TEXT,
      cancelled_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_enrollment_id ON hiv_referrals(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_visit_id ON hiv_referrals(visit_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON hiv_referrals(referral_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_date ON hiv_referrals(referral_date)`);
    
    // SMS/WhatsApp Reminders Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('appointment', 'viral_load_test', 'cd4_test', 'eac_session', 'medication_refill', 'follow_up')),
      reminder_date DATE NOT NULL,
      reminder_time TIME,
      message TEXT NOT NULL,
      phone_number VARCHAR(20),
      delivery_method VARCHAR(20) NOT NULL DEFAULT 'sms' CHECK (delivery_method IN ('sms', 'whatsapp', 'email')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
      sent_at TIMESTAMP WITH TIME ZONE,
      delivered_at TIMESTAMP WITH TIME ZONE,
      failure_reason TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_enrollment_id ON hiv_reminders(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON hiv_reminders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_status ON hiv_reminders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_date ON hiv_reminders(reminder_date)`);
    
    // Medication Stock Management Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_medication_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medication_name VARCHAR(255) NOT NULL,
      medication_code VARCHAR(50),
      medication_type VARCHAR(50) NOT NULL CHECK (medication_type IN ('arv', 'prophylaxis', 'tpt', 'other')),
      unit_of_measure VARCHAR(20) DEFAULT 'tablets',
      current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      minimum_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,
      maximum_stock_level DECIMAL(10,2),
      reorder_level DECIMAL(10,2) NOT NULL DEFAULT 0,
      expiry_date DATE,
      batch_number VARCHAR(100),
      supplier VARCHAR(255),
      last_restocked_date DATE,
      last_restocked_quantity DECIMAL(10,2),
      last_restocked_by UUID REFERENCES users(id),
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_medication_type ON hiv_medication_stock(medication_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_active ON hiv_medication_stock(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_expiry ON hiv_medication_stock(expiry_date)`);
    
    // Stock Transaction History
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_stock_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stock_id UUID NOT NULL REFERENCES hiv_medication_stock(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('dispensed', 'restocked', 'adjusted', 'expired', 'returned')),
      quantity DECIMAL(10,2) NOT NULL,
      balance_before DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      reference_type VARCHAR(50),
      reference_id UUID,
      notes TEXT,
      performed_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transactions_stock_id ON hiv_stock_transactions(stock_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON hiv_stock_transactions(transaction_date)`);
    
    // Audit Trail Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE SET NULL,
      action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('regimen_change', 'arv_status_change', 'enrollment_status_change', 'visit_created', 'visit_modified', 'lab_result_entered', 'referral_created', 'referral_updated', 'eac_session_created', 'tpt_status_change')),
      action_description TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      performed_by UUID NOT NULL REFERENCES users(id),
      performed_by_name VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_enrollment_id ON hiv_audit_log(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_action_type ON hiv_audit_log(action_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON hiv_audit_log(performed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON hiv_audit_log(created_at)`);
    
    // ARV Regimen Change Request Table - For Doctor Approval
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_change_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      request_date DATE NOT NULL DEFAULT CURRENT_DATE,
      requested_by UUID NOT NULL REFERENCES users(id),
      requested_by_name VARCHAR(255),
      
      -- Current Status
      current_regimen_code VARCHAR(10),
      current_regimen_name VARCHAR(255),
      current_viral_load DECIMAL(10,2),
      current_viral_load_date DATE,
      previous_viral_load DECIMAL(10,2),
      previous_viral_load_date DATE,
      
      -- EAC Information
      eac_completed BOOLEAN DEFAULT false,
      eac_sessions_completed INTEGER DEFAULT 0,
      eac_completion_date DATE,
      
      -- Change Request Details
      requested_regimen_code VARCHAR(10) NOT NULL,
      requested_regimen_name VARCHAR(255) NOT NULL,
      change_reason_code VARCHAR(10),
      change_reason_details TEXT,
      clinical_justification TEXT,
      
      -- Approval Status
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      approved_by UUID REFERENCES users(id),
      approved_by_name VARCHAR(255),
      approval_date DATE,
      approval_notes TEXT,
      rejection_reason TEXT,
      
      -- Visit Linkage
      visit_id UUID REFERENCES hiv_clinical_visits(id),
      visit_recorded BOOLEAN DEFAULT false,
      visit_recorded_date DATE,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_enrollment_id ON hiv_arv_change_requests(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_status ON hiv_arv_change_requests(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_requested_by ON hiv_arv_change_requests(requested_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_approved_by ON hiv_arv_change_requests(approved_by)`);
    
    // HIV Monitoring Schedules & Alerts
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_monitoring_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('viral_load', 'cd4', 'creatinine', 'alt', 'other')),
      last_test_date DATE,
      last_test_result DECIMAL(10,2),
      next_scheduled_date DATE NOT NULL,
      monitoring_frequency_months INTEGER DEFAULT 3,
      is_overdue BOOLEAN DEFAULT false,
      days_overdue INTEGER DEFAULT 0,
      alert_sent BOOLEAN DEFAULT false,
      alert_sent_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(enrollment_id, test_type)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_enrollment_id ON hiv_monitoring_schedules(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_test_type ON hiv_monitoring_schedules(test_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_next_scheduled_date ON hiv_monitoring_schedules(next_scheduled_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_is_overdue ON hiv_monitoring_schedules(is_overdue)`);
    
    // HIV Clinical Alerts
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_clinical_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('treatment_failure', 'high_vl', 'declining_cd4', 'eac_required', 'ltfu_risk', 'overdue_test', 'adherence_concern', 'side_effects', 'regimen_change_needed', 'pregnancy_risk')),
      severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_data JSONB,
      is_resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by UUID REFERENCES users(id),
      resolved_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_enrollment_id ON hiv_clinical_alerts(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON hiv_clinical_alerts(alert_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON hiv_clinical_alerts(severity)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON hiv_clinical_alerts(is_resolved)`);
    // Add unique constraint for active alerts (prevents duplicate unresolved alerts)
    statements.push(`CREATE UNIQUE INDEX IF NOT EXISTS hiv_clinical_alerts_unique_active ON hiv_clinical_alerts(enrollment_id, alert_type) WHERE is_resolved = false`);
    
    // HIV Adherence Tracking
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_adherence_tracking (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      tracking_date DATE NOT NULL,
      adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
      adherence_method VARCHAR(50) CHECK (adherence_method IN ('pill_count', 'self_report', 'pharmacy_refill', 'electronic_monitoring')),
      pills_missed INTEGER DEFAULT 0,
      pills_dispensed INTEGER,
      pills_returned INTEGER,
      missed_doses_count INTEGER DEFAULT 0,
      barriers_to_adherence TEXT[],
      interventions_provided TEXT[],
      notes TEXT,
      recorded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_enrollment_id ON hiv_adherence_tracking(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_tracking_date ON hiv_adherence_tracking(tracking_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_visit_id ON hiv_adherence_tracking(visit_id)`);
    
    // HIV Regimen History
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_regimen_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      regimen_code VARCHAR(10),
      regimen_name VARCHAR(255),
      start_date DATE NOT NULL,
      end_date DATE,
      reason_for_change VARCHAR(50),
      reason_details TEXT,
      changed_by UUID REFERENCES users(id),
      viral_load_at_change DECIMAL(10,2),
      cd4_at_change INTEGER,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_enrollment_id ON hiv_regimen_history(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_start_date ON hiv_regimen_history(start_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_is_active ON hiv_regimen_history(is_active)`);
    
    // HIV Side Effects Tracking
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_side_effects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      regimen_code VARCHAR(10),
      side_effect_type VARCHAR(100),
      severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe')),
      onset_date DATE,
      resolution_date DATE,
      intervention_provided TEXT,
      required_regimen_change BOOLEAN DEFAULT false,
      recorded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_enrollment_id ON hiv_side_effects(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_regimen_code ON hiv_side_effects(regimen_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_visit_id ON hiv_side_effects(visit_id)`);
    
    // HIV Visit Templates
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      visit_type VARCHAR(10),
      template_data JSONB NOT NULL,
      is_default BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_visit_templates_visit_type ON hiv_visit_templates(visit_type)`);
    
    // TB Screening Table
    statements.push(`CREATE TABLE IF NOT EXISTS tb_screenings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      screening_date DATE NOT NULL,
      screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('symptom_screen', 'chest_xray', 'sputum_afb', 'gene_xpert', 'culture', 'lpa')),
      screening_result VARCHAR(50) CHECK (screening_result IN ('negative', 'positive', 'indeterminate', 'pending')),
      screening_reason_snomed_code VARCHAR(50),
      screening_reason_snomed_term TEXT,
      screening_result_snomed_code VARCHAR(50),
      screening_result_snomed_term TEXT,
      symptom_cough BOOLEAN DEFAULT false,
      symptom_fever BOOLEAN DEFAULT false,
      symptom_night_sweats BOOLEAN DEFAULT false,
      symptom_weight_loss BOOLEAN DEFAULT false,
      symptom_duration_weeks INTEGER,
      symptom_snomed_codes JSONB DEFAULT '[]'::jsonb,
      chest_xray_result VARCHAR(50),
      sputum_afb_result VARCHAR(50),
      gene_xpert_result VARCHAR(50),
      culture_result VARCHAR(50),
      diagnosis_snomed_code VARCHAR(50),
      diagnosis_snomed_term TEXT,
      treatment_snomed_code VARCHAR(50),
      treatment_snomed_term TEXT,
      tb_diagnosed BOOLEAN DEFAULT false,
      tb_diagnosis_date DATE,
      tb_treatment_started BOOLEAN DEFAULT false,
      tb_treatment_start_date DATE,
      screened_by UUID NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_patient_id ON tb_screenings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_screening_date ON tb_screenings(screening_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_tb_diagnosed ON tb_screenings(tb_diagnosed)`);
    
    // Cervical Cancer Screening Table
    statements.push(`CREATE TABLE IF NOT EXISTS cervical_cancer_screenings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, screening_date DATE NOT NULL, screening_method VARCHAR(50) NOT NULL CHECK (screening_method IN ('via', 'pap_smear', 'hpv_test', 'colposcopy')), screening_method_snomed_code VARCHAR(50), screening_method_snomed_term TEXT, screening_method_snomed_module_id VARCHAR(50), screening_method_snomed_definition_status VARCHAR(50), screening_result VARCHAR(50) CHECK (screening_result IN ('normal', 'abnormal', 'positive', 'negative', 'suspicious', 'pending')), screening_result_snomed_code VARCHAR(50), screening_result_snomed_term TEXT, screening_result_snomed_module_id VARCHAR(50), screening_result_snomed_definition_status VARCHAR(50), via_result VARCHAR(50), via_result_snomed JSONB DEFAULT '[]'::jsonb, pap_result VARCHAR(50), pap_result_snomed JSONB DEFAULT '[]'::jsonb, hpv_result VARCHAR(50), hpv_result_snomed JSONB DEFAULT '[]'::jsonb, hpv_types TEXT[], colposcopy_result VARCHAR(50), colposcopy_result_snomed JSONB DEFAULT '[]'::jsonb, biopsy_required BOOLEAN DEFAULT false, biopsy_result VARCHAR(50), biopsy_result_snomed_code VARCHAR(50), biopsy_result_snomed_term TEXT, biopsy_result_snomed_module_id VARCHAR(50), biopsy_result_snomed_definition_status VARCHAR(50), treatment_provided TEXT, treatment_provided_snomed JSONB DEFAULT '[]'::jsonb, treatment_date DATE, next_screening_date DATE, screened_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_patient_id ON cervical_cancer_screenings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_screening_date ON cervical_cancer_screenings(screening_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_method_snomed ON cervical_cancer_screenings(screening_method_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_result_snomed ON cervical_cancer_screenings(screening_result_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_biopsy_snomed ON cervical_cancer_screenings(biopsy_result_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_via_result_snomed ON cervical_cancer_screenings USING GIN(via_result_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_pap_result_snomed ON cervical_cancer_screenings USING GIN(pap_result_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_hpv_result_snomed ON cervical_cancer_screenings USING GIN(hpv_result_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_colposcopy_result_snomed ON cervical_cancer_screenings USING GIN(colposcopy_result_snomed)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_treatment_snomed ON cervical_cancer_screenings USING GIN(treatment_provided_snomed)`);
    
    // ============================================
    // HIV VISIT LOOKUP TABLES
    // ============================================
    
    // WHO Clinical Staging - Version 6 (January 2024)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_who_staging (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3, 4)),
      category VARCHAR(20) NOT NULL CHECK (category IN ('Adults', 'Paediatrics')),
      condition_code VARCHAR(50) UNIQUE NOT NULL,
      condition_name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_who_staging_stage ON hiv_who_staging(stage)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_who_staging_category ON hiv_who_staging(category)`);
    
    // Visit Types
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_visit_types_code ON hiv_visit_types(code)`);
    
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_service_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_outreach_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_partner_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_linkage_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_sti_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_testing_sti_specimens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // BMI Classifications (for reference, but can be calculated)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_bmi_classifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      min_bmi DECIMAL(4,1),
      max_bmi DECIMAL(4,1),
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Pregnancy/Breastfeeding Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_pregnancy_lactating_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Family Planning Methods
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_family_planning_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Functional Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_functional_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TB Screening Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tb_screening_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TB Investigation Results
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tb_investigation_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Opportunistic Infections and Other Problems
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_opportunistic_infections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50),
      description TEXT,
      has_sub_categories BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_code ON hiv_opportunistic_infections(code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_category ON hiv_opportunistic_infections(category)`);
    
    // OI Sub-categories (for Hypertension, Diabetes, Hepatitis B/C, Cancer)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_oi_sub_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      oi_id UUID NOT NULL REFERENCES hiv_opportunistic_infections(id) ON DELETE CASCADE,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_sub_categories_oi_id ON hiv_oi_sub_categories(oi_id)`);
    
    // Mental Health Screening Results
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_mental_health_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Mental Health Management Actions
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_mental_health_management (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TPT Eligibility
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tpt_eligibility (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_eligible BOOLEAN,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TPT Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tpt_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Signs
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_signs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Meningitis Treatment
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_treatment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ART Initiation Category
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_initiation_category (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Adverse Events Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_adverse_events_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(20) CHECK (severity IN ('minor', 'major', 'stopping')),
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Reasons (Not on ARV)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_reasons_not_on (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Reasons (Start ARV)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_reasons_start (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Reason for Change/Stop ARV
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_change_stop_reasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Visit Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Final Outcome
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_final_outcome (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ART Regimens - CRITICAL: These change frequently
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_regimens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      line VARCHAR(20) NOT NULL CHECK (line IN ('1st Line', '2nd Line', '3rd Line', 'Children 1st Line', 'Children 2nd Line', 'Children 3rd Line')),
      category VARCHAR(50) NOT NULL CHECK (category IN ('Adult', 'Paediatric')),
      components TEXT[] NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      is_preferred BOOLEAN DEFAULT false,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_code ON hiv_art_regimens(code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_line ON hiv_art_regimens(line)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_category ON hiv_art_regimens(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_is_active ON hiv_art_regimens(is_active)`);
    
    // Pre-Cancerous Lesion Treatment
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_precancerous_lesion_treatment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Financial Transactions Core Tables
    statements.push(`CREATE TABLE IF NOT EXISTS financial_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
      payer_type VARCHAR(30) DEFAULT 'self' CHECK (payer_type IN ('self','medical_aid','corporate')),
      source_module VARCHAR(50),
      source_reference_id UUID,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending','partially_paid','paid','written_off')),
      due_date TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_transactions_patient ON financial_transactions(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(payment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_transactions_module ON financial_transactions(source_module)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON financial_transactions(due_date)`);

    statements.push(`CREATE TABLE IF NOT EXISTS financial_line_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      billing_code VARCHAR(50),
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
      discount NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_line_items_transaction ON financial_line_items(transaction_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_line_items_code ON financial_line_items(billing_code)`);

    statements.push(`CREATE TABLE IF NOT EXISTS financial_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
      payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash','card','mobile_money','bank_transfer','medical_aid','write_off')),
      payment_reference VARCHAR(100),
      gateway_reference VARCHAR(150),
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
      received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      processed_by UUID REFERENCES users(id),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_payments_transaction ON financial_payments(transaction_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_payments_method ON financial_payments(payment_method)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_payments_status ON financial_payments(status)`);

    statements.push(`CREATE TABLE IF NOT EXISTS financial_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
      claim_number VARCHAR(100),
      payer_name VARCHAR(255),
      submission_date TIMESTAMP WITH TIME ZONE,
      amount_submitted NUMERIC(12,2),
      amount_approved NUMERIC(12,2),
      status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','rejected','paid')),
      response_code VARCHAR(50),
      response_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_claims_transaction ON financial_claims(transaction_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_claims_status ON financial_claims(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_claims_number ON financial_claims(claim_number)`);

    statements.push(`CREATE TABLE IF NOT EXISTS financial_reconciliation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
      payment_reference VARCHAR(150),
      payment_method VARCHAR(30),
      amount NUMERIC(12,2),
      status VARCHAR(30) DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','partial','disputed')),
      reconciliation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      source_filename VARCHAR(255),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_status ON financial_reconciliation_logs(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_reference ON financial_reconciliation_logs(payment_reference)`);

    // Cardiology module
    statements.push(`CREATE TABLE IF NOT EXISTS cardiology_encounters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      encounter_date TIMESTAMP WITH TIME ZONE NOT NULL,
      encounter_type VARCHAR(50) CHECK (encounter_type IN ('clinic_visit','diagnostic_test','heart_failure_review','telecardiology','rehabilitation','other')),
      cardiologist_id UUID REFERENCES users(id),
      visit_reason TEXT,
      reason_snomed_code VARCHAR(50),
      reason_snomed_term TEXT,
      reason_snomed_module_id VARCHAR(50),
      reason_snomed_definition_status VARCHAR(50),
      presenting_symptoms TEXT,
      symptom_snomed_codes JSONB DEFAULT '[]'::jsonb,
      hemodynamics JSONB DEFAULT '{}'::jsonb,
      diagnostic_tests JSONB DEFAULT '[]'::jsonb,
      diagnostic_snomed_codes JSONB DEFAULT '[]'::jsonb,
      care_plan TEXT,
      follow_up_plan TEXT,
      risk_score VARCHAR(20) CHECK (risk_score IN ('low','moderate','high','critical')),
      care_status VARCHAR(30) DEFAULT 'scheduled' CHECK (care_status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled')),
      fee_amount NUMERIC(12,2),
      finance_transaction_id UUID,
      payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_patient_id ON cardiology_encounters(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_date ON cardiology_encounters(encounter_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_payment_status ON cardiology_encounters(payment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_care_status ON cardiology_encounters(care_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_reason_snomed ON cardiology_encounters(reason_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_risk_score ON cardiology_encounters(risk_score)`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2)`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS finance_transaction_id UUID`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'payment_confirmed'`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS care_status VARCHAR(30) DEFAULT 'scheduled'`);
    statements.push(`ALTER TABLE cardiology_encounters DROP CONSTRAINT IF EXISTS cardiology_encounters_payment_status_check`);
    statements.push(`ALTER TABLE cardiology_encounters ADD CONSTRAINT cardiology_encounters_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'))`);
    statements.push(`ALTER TABLE cardiology_encounters DROP CONSTRAINT IF EXISTS cardiology_encounters_care_status_check`);
    statements.push(`ALTER TABLE cardiology_encounters ADD CONSTRAINT cardiology_encounters_care_status_check CHECK (care_status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled'))`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_term TEXT`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_module_id VARCHAR(50)`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_definition_status VARCHAR(50)`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS symptom_snomed_codes JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS diagnostic_snomed_codes JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS follow_up_date DATE`);

    statements.push(`CREATE TABLE IF NOT EXISTS hiv_nurse_intakes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      intake_date DATE,
      recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      form JSONB NOT NULL DEFAULT '{}'::jsonb,
      vitals JSONB DEFAULT '{}'::jsonb,
      adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
      regimen TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_patient_id ON hiv_nurse_intakes(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_appointment_id ON hiv_nurse_intakes(appointment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_recorded_at ON hiv_nurse_intakes(recorded_at)`);

    // SNOMED CT Terminology Service Tables
    statements.push(`CREATE TABLE IF NOT EXISTS snomed_search_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      search_term VARCHAR(255) NOT NULL,
      result_limit INTEGER NOT NULL,
      result_offset INTEGER NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(search_term, result_limit, result_offset)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_term ON snomed_search_cache(search_term)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_created ON snomed_search_cache(created_at)`);

    statements.push(`CREATE TABLE IF NOT EXISTS snomed_concept_cache (
      concept_id VARCHAR(50) PRIMARY KEY,
      concept_data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_concept_cache_created ON snomed_concept_cache(created_at)`);

    statements.push(`CREATE TABLE IF NOT EXISTS snomed_mapping_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_code VARCHAR(50) NOT NULL,
      target_code VARCHAR(50) NOT NULL,
      target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
      map_category VARCHAR(100),
      active BOOLEAN NOT NULL DEFAULT true,
      mapping_data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(source_code, target_code, target_system)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_mapping_source ON snomed_mapping_cache(source_code, target_system)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_mapping_target ON snomed_mapping_cache(target_code, target_system)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_mapping_active ON snomed_mapping_cache(active)`);

    statements.push(`CREATE TABLE IF NOT EXISTS snomed_manual_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_code VARCHAR(50) NOT NULL,
      target_code VARCHAR(50) NOT NULL,
      target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
      map_category VARCHAR(100),
      description TEXT,
      created_by UUID REFERENCES users(id),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(source_code, target_code, target_system)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_source ON snomed_manual_mappings(source_code, target_system)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_active ON snomed_manual_mappings(active)`);

    return statements;
  }

  private getSprint5SchemaStatements(): string[] {
    return [
      // Appointment Waitlist Table
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

      // Invoice Table Enhancement (if not exists, add columns)
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

      // Invoice Templates Table
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

      // Lab Order Templates Table
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

      // Imaging Order Templates Table
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

      // Add updated_at trigger for new tables
      `CREATE TRIGGER IF NOT EXISTS update_appointment_waitlist_updated_at BEFORE UPDATE ON appointment_waitlist
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_invoice_templates_updated_at BEFORE UPDATE ON invoice_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_lab_order_templates_updated_at BEFORE UPDATE ON lab_order_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_imaging_order_templates_updated_at BEFORE UPDATE ON imaging_order_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint6DiabetesSchemaStatements(): string[] {
    return [
      // Diabetes Registry
      `CREATE TABLE IF NOT EXISTS diabetes_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        diabetes_type VARCHAR(30) NOT NULL CHECK (diabetes_type IN ('type1','type2','gestational','lada','mody','secondary','prediabetes','other')),
        diabetes_type_snomed_code VARCHAR(50),
        diabetes_type_snomed_term TEXT,
        diagnosis_date DATE NOT NULL,
        age_at_diagnosis INTEGER,
        status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','in_remission','resolved','deceased')),
        family_history BOOLEAN DEFAULT false,
        primary_care_provider_id UUID REFERENCES users(id),
        endocrinologist_id UUID REFERENCES users(id),
        diabetes_educator_id UUID REFERENCES users(id),
        care_plan TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(patient_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_registry_patient_id ON diabetes_registry(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_registry_type ON diabetes_registry(diabetes_type)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_registry_status ON diabetes_registry(status)`,

      // Diabetes Care Bundle
      `CREATE TABLE IF NOT EXISTS diabetes_care_bundle (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        bundle_date DATE NOT NULL DEFAULT CURRENT_DATE,
        hba1c_checked BOOLEAN DEFAULT false,
        hba1c_value NUMERIC(5,2),
        hba1c_date DATE,
        blood_pressure_checked BOOLEAN DEFAULT false,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        bp_date DATE,
        lipid_profile_checked BOOLEAN DEFAULT false,
        lipid_profile_date DATE,
        foot_exam_checked BOOLEAN DEFAULT false,
        foot_exam_date DATE,
        foot_exam_result TEXT,
        eye_exam_checked BOOLEAN DEFAULT false,
        eye_exam_date DATE,
        eye_exam_result TEXT,
        urine_acr_checked BOOLEAN DEFAULT false,
        urine_acr_value NUMERIC(10,2),
        urine_acr_date DATE,
        diabetes_education_documented BOOLEAN DEFAULT false,
        education_date DATE,
        medication_review_completed BOOLEAN DEFAULT false,
        medication_review_date DATE,
        bundle_completion_percentage INTEGER CHECK (bundle_completion_percentage IS NULL OR (bundle_completion_percentage >= 0 AND bundle_completion_percentage <= 100)),
        reviewed_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_care_bundle_registry_id ON diabetes_care_bundle(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_care_bundle_patient_id ON diabetes_care_bundle(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_care_bundle_date ON diabetes_care_bundle(bundle_date)`,

      // Glucose Monitoring
      `CREATE TABLE IF NOT EXISTS glucose_monitoring (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        monitoring_type VARCHAR(30) NOT NULL CHECK (monitoring_type IN ('self_monitoring','cgm','flash','lab')),
        device_type VARCHAR(100),
        device_id VARCHAR(255),
        glucose_value NUMERIC(6,2) NOT NULL,
        glucose_unit VARCHAR(10) DEFAULT 'mg/dL' CHECK (glucose_unit IN ('mg/dL','mmol/L')),
        reading_type VARCHAR(30) CHECK (reading_type IN ('fasting','pre_meal','post_meal','random','bedtime','overnight','other')),
        meal_context TEXT,
        insulin_dose NUMERIC(8,2),
        insulin_type VARCHAR(100),
        carbohydrates_grams NUMERIC(6,2),
        exercise_minutes INTEGER,
        stress_level INTEGER CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
        notes TEXT,
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        recorded_by UUID REFERENCES users(id),
        device_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_glucose_monitoring_registry_id ON glucose_monitoring(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_glucose_monitoring_patient_id ON glucose_monitoring(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_glucose_monitoring_recorded_at ON glucose_monitoring(recorded_at)`,

      // CGM Summary
      `CREATE TABLE IF NOT EXISTS cgm_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        summary_date DATE NOT NULL,
        time_in_range_70_180 NUMERIC(5,2),
        time_above_range_180 NUMERIC(5,2),
        time_below_range_70 NUMERIC(5,2),
        time_below_range_54 NUMERIC(5,2),
        average_glucose NUMERIC(6,2),
        glucose_variability NUMERIC(6,2),
        total_readings INTEGER,
        device_type VARCHAR(100),
        device_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(diabetes_registry_id, summary_date)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cgm_summary_registry_id ON cgm_summary(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cgm_summary_patient_id ON cgm_summary(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cgm_summary_date ON cgm_summary(summary_date)`,

      // Diabetes Medications
      `CREATE TABLE IF NOT EXISTS diabetes_medications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        medication_name VARCHAR(255) NOT NULL,
        medication_type VARCHAR(30) NOT NULL CHECK (medication_type IN ('oral','injectable','insulin','combination','other')),
        medication_category VARCHAR(100) CHECK (medication_category IN ('metformin','sulfonylurea','dpp4_inhibitor','sglt2_inhibitor','glp1_agonist','thiazolidinedione','alpha_glucosidase_inhibitor','meglitinide','insulin_basal','insulin_bolus','insulin_premixed','other')),
        medication_snomed_code VARCHAR(50),
        medication_snomed_term TEXT,
        dosage VARCHAR(100) NOT NULL,
        frequency VARCHAR(100) NOT NULL,
        route VARCHAR(50) CHECK (route IN ('oral','subcutaneous','intramuscular','intravenous','inhalation','other')),
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','discontinued','on_hold','completed')),
        adherence_percentage INTEGER CHECK (adherence_percentage IS NULL OR (adherence_percentage >= 0 AND adherence_percentage <= 100)),
        prescribed_by UUID REFERENCES users(id),
        reason_for_discontinuation TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_medications_registry_id ON diabetes_medications(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_medications_patient_id ON diabetes_medications(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_medications_status ON diabetes_medications(status)`,

      // Insulin Regimens
      `CREATE TABLE IF NOT EXISTS insulin_regimens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        regimen_type VARCHAR(30) NOT NULL CHECK (regimen_type IN ('basal_only','basal_bolus','premixed','pump','other')),
        basal_insulin_type VARCHAR(100),
        basal_dose NUMERIC(8,2),
        basal_frequency VARCHAR(100),
        bolus_insulin_type VARCHAR(100),
        bolus_ratio NUMERIC(6,2),
        correction_factor NUMERIC(6,2),
        target_glucose NUMERIC(6,2),
        carb_ratio NUMERIC(6,2),
        pump_settings JSONB DEFAULT '{}'::jsonb,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','discontinued','on_hold')),
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_insulin_regimens_registry_id ON insulin_regimens(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_insulin_regimens_patient_id ON insulin_regimens(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_insulin_regimens_status ON insulin_regimens(status)`,
      `CREATE INDEX IF NOT EXISTS idx_insulin_regimens_start_date ON insulin_regimens(start_date)`,

      // Complication Screening
      `CREATE TABLE IF NOT EXISTS diabetes_complication_screening (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('retinopathy','neuropathy','nephropathy','cardiovascular','foot_ulcer','other')),
        screening_date DATE NOT NULL,
        screening_result TEXT,
        screening_result_snomed_code VARCHAR(50),
        screening_result_snomed_term TEXT,
        severity_grade VARCHAR(50),
        findings TEXT,
        treatment_recommended BOOLEAN DEFAULT false,
        treatment_plan TEXT,
        next_screening_due_date DATE,
        performed_by UUID REFERENCES users(id),
        reviewed_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_complication_screening_registry_id ON diabetes_complication_screening(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_complication_screening_patient_id ON diabetes_complication_screening(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_complication_screening_type ON diabetes_complication_screening(screening_type)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_complication_screening_due_date ON diabetes_complication_screening(next_screening_due_date)`,

      // Education Sessions
      `CREATE TABLE IF NOT EXISTS diabetes_education_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        session_type VARCHAR(30) NOT NULL CHECK (session_type IN ('individual','group','online','phone','other')),
        topics_covered TEXT[] DEFAULT '{}',
        educator_id UUID REFERENCES users(id),
        patient_attendance BOOLEAN DEFAULT true,
        completion_status VARCHAR(30) DEFAULT 'completed' CHECK (completion_status IN ('completed','partial','missed','rescheduled')),
        assessment_score INTEGER CHECK (assessment_score IS NULL OR (assessment_score >= 0 AND assessment_score <= 100)),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_education_sessions_registry_id ON diabetes_education_sessions(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_education_sessions_patient_id ON diabetes_education_sessions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_education_sessions_date ON diabetes_education_sessions(session_date)`,

      // Diabetes Alerts
      `CREATE TABLE IF NOT EXISTS diabetes_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('overdue_screening','abnormal_value','medication_adherence','hypoglycemia','hyperglycemia','care_bundle_incomplete','device_issue','other')),
        alert_severity VARCHAR(20) NOT NULL CHECK (alert_severity IN ('low','medium','high','critical')),
        alert_message TEXT NOT NULL,
        related_metric VARCHAR(100),
        related_value NUMERIC(12,4),
        related_date DATE,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        resolved BOOLEAN DEFAULT false,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolution_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_alerts_registry_id ON diabetes_alerts(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_alerts_patient_id ON diabetes_alerts(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_alerts_type ON diabetes_alerts(alert_type)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_alerts_severity ON diabetes_alerts(alert_severity)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_alerts_resolved ON diabetes_alerts(resolved)`,

      // Device Integration
      `CREATE TABLE IF NOT EXISTS diabetes_device_integration (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('cgm','insulin_pump','glucose_meter','smart_pen','fitness_tracker','other')),
        device_brand VARCHAR(100),
        device_model VARCHAR(100),
        device_serial_number VARCHAR(255),
        device_id VARCHAR(255),
        integration_type VARCHAR(30) CHECK (integration_type IN ('api','hl7','fhir','manual','healthkit','google_fit','file_upload')),
        integration_status VARCHAR(30) DEFAULT 'active' CHECK (integration_status IN ('active','inactive','error','pending','revoked')),
        last_sync_at TIMESTAMP WITH TIME ZONE,
        sync_frequency VARCHAR(50),
        api_credentials_encrypted TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_device_integration_registry_id ON diabetes_device_integration(diabetes_registry_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_device_integration_patient_id ON diabetes_device_integration(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_device_integration_type ON diabetes_device_integration(device_type)`,
      `CREATE INDEX IF NOT EXISTS idx_diabetes_device_integration_status ON diabetes_device_integration(integration_status)`,

      // Updated_at triggers
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_registry_updated_at BEFORE UPDATE ON diabetes_registry
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_care_bundle_updated_at BEFORE UPDATE ON diabetes_care_bundle
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_glucose_monitoring_updated_at BEFORE UPDATE ON glucose_monitoring
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_cgm_summary_updated_at BEFORE UPDATE ON cgm_summary
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_medications_updated_at BEFORE UPDATE ON diabetes_medications
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_insulin_regimens_updated_at BEFORE UPDATE ON insulin_regimens
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_complication_screening_updated_at BEFORE UPDATE ON diabetes_complication_screening
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_education_sessions_updated_at BEFORE UPDATE ON diabetes_education_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_alerts_updated_at BEFORE UPDATE ON diabetes_alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER IF NOT EXISTS update_diabetes_device_integration_updated_at BEFORE UPDATE ON diabetes_device_integration
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
    ];
  }

  private getSprint7OncologySchemaStatements(): string[] {
    const statements: string[] = [];

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_imaging_findings (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_imaging_findings_case_id ON oncology_imaging_findings(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_imaging_findings_date ON oncology_imaging_findings(imaging_date)`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_pathology (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_pathology_case_id ON oncology_pathology(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_pathology_specimen_date ON oncology_pathology(specimen_date)`);
    statements.push(`ALTER TABLE oncology_pathology ADD COLUMN IF NOT EXISTS genomic_data JSONB DEFAULT '{}'::jsonb`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_response_assessments (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_response_case_id ON oncology_response_assessments(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_response_date ON oncology_response_assessments(assessment_date)`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_survivorship_plans (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_survivorship_case_id ON oncology_survivorship_plans(oncology_case_id)`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_clinical_trials (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_clinical_trials_case_id ON oncology_clinical_trials(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_clinical_trials_status ON oncology_clinical_trials(enrollment_status)`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_patient_reported_outcomes (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_pro_case_id ON oncology_patient_reported_outcomes(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_pro_assessment_date ON oncology_patient_reported_outcomes(assessment_date)`);

    statements.push(`CREATE TABLE IF NOT EXISTS oncology_financial_toxicity (
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
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_financial_toxicity_case_id ON oncology_financial_toxicity(oncology_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oncology_financial_toxicity_date ON oncology_financial_toxicity(assessment_date)`);

    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS insurance_coverage_percentage NUMERIC(5,2)`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS out_of_pocket_cost NUMERIC(12,2)`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS financial_assistance_received BOOLEAN`);
    statements.push(`ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS financial_assistance_program VARCHAR(255)`);

    return statements;
  }

  private getSprint8PharmacySchemaStatements(): string[] {
    const statements: string[] = [];

    // Pharmacy Suppliers
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      payment_terms VARCHAR(100),
      tax_id VARCHAR(100),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_suppliers_name ON pharmacy_suppliers(name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_suppliers_status ON pharmacy_suppliers(status)`);

    // Pharmacy Inventory
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255),
      generic_name VARCHAR(255),
      sku VARCHAR(100),
      barcode VARCHAR(100),
      drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
      snomed_code VARCHAR(50),
      snomed_term TEXT,
      category VARCHAR(100),
      unit_of_measure VARCHAR(50) DEFAULT 'unit',
      quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
      reorder_level INTEGER DEFAULT 10 CHECK (reorder_level >= 0),
      max_stock_level INTEGER CHECK (max_stock_level > 0),
      cost_per_unit NUMERIC(12,2) CHECK (cost_per_unit >= 0),
      selling_price NUMERIC(12,2) CHECK (selling_price >= 0),
      expiry_date DATE,
      batch_number VARCHAR(100),
      location VARCHAR(100),
      supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','discontinued','expired','recalled')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_name ON pharmacy_inventory(name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_sku ON pharmacy_inventory(sku)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_drug_id ON pharmacy_inventory(drug_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_status ON pharmacy_inventory(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_supplier_id ON pharmacy_inventory(supplier_id)`);

    // Pharmacy Purchase Orders
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_purchase_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number VARCHAR(50) UNIQUE NOT NULL,
      supplier_id UUID NOT NULL REFERENCES pharmacy_suppliers(id) ON DELETE RESTRICT,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_delivery_date DATE,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','ordered','received','cancelled')),
      total_amount NUMERIC(12,2) DEFAULT 0 CHECK (total_amount >= 0),
      currency VARCHAR(10) DEFAULT 'USD',
      notes TEXT,
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMP WITH TIME ZONE,
      ordered_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_order_number ON pharmacy_purchase_orders(order_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_supplier_id ON pharmacy_purchase_orders(supplier_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_status ON pharmacy_purchase_orders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_order_date ON pharmacy_purchase_orders(order_date)`);

    // Pharmacy Purchase Order Items
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_purchase_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_order_id UUID NOT NULL REFERENCES pharmacy_purchase_orders(id) ON DELETE CASCADE,
      drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
      rxnorm_code VARCHAR(50),
      quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
      unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
      total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
      quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_items_po_id ON pharmacy_purchase_order_items(purchase_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_po_items_drug_id ON pharmacy_purchase_order_items(drug_id)`);

    // Pharmacy Receipts (GRN)
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      receipt_number VARCHAR(50) UNIQUE NOT NULL,
      purchase_order_id UUID REFERENCES pharmacy_purchase_orders(id) ON DELETE SET NULL,
      supplier_id UUID NOT NULL REFERENCES pharmacy_suppliers(id) ON DELETE RESTRICT,
      receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
      received_by UUID REFERENCES users(id),
      verified_by UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','processed')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipts_receipt_number ON pharmacy_receipts(receipt_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipts_po_id ON pharmacy_receipts(purchase_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipts_supplier_id ON pharmacy_receipts(supplier_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipts_status ON pharmacy_receipts(status)`);

    // Pharmacy Receipt Items
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_receipt_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      receipt_id UUID NOT NULL REFERENCES pharmacy_receipts(id) ON DELETE CASCADE,
      purchase_order_item_id UUID REFERENCES pharmacy_purchase_order_items(id) ON DELETE SET NULL,
      drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
      batch_number VARCHAR(100),
      expiry_date DATE NOT NULL,
      manufacturing_date DATE,
      quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
      unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
      total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity_received * unit_cost) STORED,
      condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good','damaged','expired','short_supply')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipt_items_receipt_id ON pharmacy_receipt_items(receipt_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipt_items_po_item_id ON pharmacy_receipt_items(purchase_order_item_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_receipt_items_drug_id ON pharmacy_receipt_items(drug_id)`);

    // Pharmacy Dispensings
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_dispensings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      dispensing_number VARCHAR(50) UNIQUE NOT NULL,
      dispensing_date DATE NOT NULL DEFAULT CURRENT_DATE,
      dispensed_by UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','dispensed','partial','cancelled','returned')),
      payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','partially_paid','refunded')),
      payment_method VARCHAR(50),
      total_amount NUMERIC(12,2) DEFAULT 0 CHECK (total_amount >= 0),
      amount_paid NUMERIC(12,2) DEFAULT 0 CHECK (amount_paid >= 0),
      discount_amount NUMERIC(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
      bill_id UUID REFERENCES billing(id) ON DELETE SET NULL,
      ai_review_acknowledged_at TIMESTAMPTZ NULL,
      ai_review_acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      ai_review_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_dispensing_number ON pharmacy_dispensings(dispensing_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_prescription_id ON pharmacy_dispensings(prescription_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_patient_id ON pharmacy_dispensings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_status ON pharmacy_dispensings(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_payment_status ON pharmacy_dispensings(payment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_dispensing_date ON pharmacy_dispensings(dispensing_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_bill_id ON pharmacy_dispensings(bill_id)`);
    // Add bill_id column if it doesn't exist (for existing databases)
    statements.push(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_dispensings' AND column_name = 'bill_id') THEN ALTER TABLE pharmacy_dispensings ADD COLUMN bill_id UUID REFERENCES billing(id) ON DELETE SET NULL; END IF; END $$;`);

    // Pharmacy Dispensing Items
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_dispensing_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispensing_id UUID NOT NULL REFERENCES pharmacy_dispensings(id) ON DELETE CASCADE,
      inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
      drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
      rxnorm_code VARCHAR(50),
      batch_number VARCHAR(100),
      expiry_date DATE,
      quantity_dispensed INTEGER NOT NULL CHECK (quantity_dispensed > 0),
      unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
      total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity_dispensed * unit_price) STORED,
      instructions TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_dispensing_id ON pharmacy_dispensing_items(dispensing_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_inventory_id ON pharmacy_dispensing_items(inventory_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_drug_id ON pharmacy_dispensing_items(drug_id)`);

    // Pharmacy Returns
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_returns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispensing_id UUID NOT NULL REFERENCES pharmacy_dispensings(id) ON DELETE RESTRICT,
      return_date DATE NOT NULL DEFAULT CURRENT_DATE,
      return_reason VARCHAR(100),
      returned_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
      refund_amount NUMERIC(12,2) DEFAULT 0 CHECK (refund_amount >= 0),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_returns_dispensing_id ON pharmacy_returns(dispensing_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_returns_status ON pharmacy_returns(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_returns_return_date ON pharmacy_returns(return_date)`);

    // Pharmacy Return Items
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_return_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id UUID NOT NULL REFERENCES pharmacy_returns(id) ON DELETE CASCADE,
      dispensing_item_id UUID REFERENCES pharmacy_dispensing_items(id) ON DELETE SET NULL,
      inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
      quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
      condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good','damaged','expired')),
      restockable BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_return_items_return_id ON pharmacy_return_items(return_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_return_items_dispensing_item_id ON pharmacy_return_items(dispensing_item_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_return_items_inventory_id ON pharmacy_return_items(inventory_id)`);

    // Pharmacy Stock Movements
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
      movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('purchase','sale','return','adjustment','expiry','damage','transfer')),
      reference_type VARCHAR(50),
      reference_id UUID,
      quantity_before INTEGER NOT NULL,
      quantity_change INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      unit_cost NUMERIC(12,2),
      movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
      performed_by UUID REFERENCES users(id),
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_movements_inventory_id ON pharmacy_stock_movements(inventory_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_movements_movement_type ON pharmacy_stock_movements(movement_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_movements_reference ON pharmacy_stock_movements(reference_type, reference_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_movements_date ON pharmacy_stock_movements(movement_date)`);

    // Pharmacy Stock Adjustments
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      adjustment_number VARCHAR(50) UNIQUE NOT NULL,
      adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('increase','decrease','correction')),
      reason VARCHAR(100),
      approved_by UUID REFERENCES users(id),
      performed_by UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustments_adjustment_number ON pharmacy_stock_adjustments(adjustment_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustments_status ON pharmacy_stock_adjustments(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustments_date ON pharmacy_stock_adjustments(adjustment_date)`);

    // Pharmacy Stock Adjustment Items
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustment_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      adjustment_id UUID NOT NULL REFERENCES pharmacy_stock_adjustments(id) ON DELETE CASCADE,
      inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
      quantity_before INTEGER NOT NULL,
      quantity_adjustment INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      unit_cost NUMERIC(12,2),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustment_items_adjustment_id ON pharmacy_stock_adjustment_items(adjustment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustment_items_inventory_id ON pharmacy_stock_adjustment_items(inventory_id)`);

    // Pharmacy Pricing Rules
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_pricing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name VARCHAR(255) NOT NULL,
      rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('markup_percentage','markup_fixed','discount_percentage','discount_fixed','fixed_price')),
      markup_percentage NUMERIC(5,2) CHECK (markup_percentage >= 0),
      markup_fixed NUMERIC(12,2) CHECK (markup_fixed >= 0),
      discount_percentage NUMERIC(5,2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
      discount_fixed NUMERIC(12,2) CHECK (discount_fixed >= 0),
      fixed_price NUMERIC(12,2) CHECK (fixed_price >= 0),
      applies_to VARCHAR(20) NOT NULL CHECK (applies_to IN ('all','category','drug','supplier')),
      category_id UUID,
      drug_id UUID REFERENCES drugs(id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE CASCADE,
      priority INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_to DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_active ON pharmacy_pricing_rules(active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_applies_to ON pharmacy_pricing_rules(applies_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_drug_id ON pharmacy_pricing_rules(drug_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_supplier_id ON pharmacy_pricing_rules(supplier_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_priority ON pharmacy_pricing_rules(priority DESC)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_valid_dates ON pharmacy_pricing_rules(valid_from, valid_to)`);

    // Pharmacy Formulary
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_formulary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medical_aid_id UUID,
      medical_aid_name VARCHAR(255),
      drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
      rxnorm_code VARCHAR(50),
      covered BOOLEAN DEFAULT true,
      requires_prior_auth BOOLEAN DEFAULT false,
      co_pay_amount NUMERIC(12,2) CHECK (co_pay_amount >= 0),
      co_pay_percentage NUMERIC(5,2) CHECK (co_pay_percentage >= 0 AND co_pay_percentage <= 100),
      max_quantity_per_month INTEGER CHECK (max_quantity_per_month > 0),
      max_days_supply INTEGER CHECK (max_days_supply > 0),
      tier VARCHAR(20),
      effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expiry_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_medical_aid ON pharmacy_formulary(medical_aid_id, medical_aid_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_drug_id ON pharmacy_formulary(drug_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_rxnorm_code ON pharmacy_formulary(rxnorm_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_covered ON pharmacy_formulary(covered)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_effective_dates ON pharmacy_formulary(effective_date, expiry_date)`);

    // Pharmacy Alerts
    statements.push(`CREATE TABLE IF NOT EXISTS pharmacy_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low_stock','out_of_stock','expiring_soon','expired','reorder_due','price_change')),
      inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
      severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
      alert_message TEXT NOT NULL,
      related_data JSONB DEFAULT '{}'::jsonb,
      acknowledged BOOLEAN DEFAULT false,
      acknowledged_by UUID REFERENCES users(id),
      acknowledged_at TIMESTAMP WITH TIME ZONE,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_alert_type ON pharmacy_alerts(alert_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_inventory_id ON pharmacy_alerts(inventory_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_severity ON pharmacy_alerts(severity)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_acknowledged ON pharmacy_alerts(acknowledged)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_resolved ON pharmacy_alerts(resolved)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_created_at ON pharmacy_alerts(created_at)`);

    // Triggers for updated_at
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_suppliers_updated_at BEFORE UPDATE ON pharmacy_suppliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_inventory_updated_at BEFORE UPDATE ON pharmacy_inventory
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_purchase_orders_updated_at BEFORE UPDATE ON pharmacy_purchase_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_purchase_order_items_updated_at BEFORE UPDATE ON pharmacy_purchase_order_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_receipts_updated_at BEFORE UPDATE ON pharmacy_receipts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_receipt_items_updated_at BEFORE UPDATE ON pharmacy_receipt_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_dispensings_updated_at BEFORE UPDATE ON pharmacy_dispensings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_dispensing_items_updated_at BEFORE UPDATE ON pharmacy_dispensing_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_returns_updated_at BEFORE UPDATE ON pharmacy_returns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_return_items_updated_at BEFORE UPDATE ON pharmacy_return_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_stock_adjustments_updated_at BEFORE UPDATE ON pharmacy_stock_adjustments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_stock_adjustment_items_updated_at BEFORE UPDATE ON pharmacy_stock_adjustment_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_pricing_rules_updated_at BEFORE UPDATE ON pharmacy_pricing_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_pharmacy_formulary_updated_at BEFORE UPDATE ON pharmacy_formulary
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

    return statements;
  }

  private getAppointmentEnhancementsSchemaStatements(): string[] {
    const statements: string[] = [];

    // Doctor Availability/Unavailability
    statements.push(`CREATE TABLE IF NOT EXISTS doctor_availability (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE,
      start_time TIME,
      end_time TIME,
      is_all_day BOOLEAN DEFAULT false,
      is_unavailable BOOLEAN DEFAULT true,
      reason VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_id ON doctor_availability(doctor_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doctor_availability_dates ON doctor_availability(start_date, end_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doctor_availability_is_unavailable ON doctor_availability(is_unavailable)`);
    statements.push(`CREATE TRIGGER IF NOT EXISTS update_doctor_availability_updated_at BEFORE UPDATE ON doctor_availability
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

    return statements;
  }

  private getBillingClaimsEnhancementsStatements(): string[] {
    const statements: string[] = [];

    // Update medical_aid_claims table structure to match actual schema
    statements.push(`DO $$ 
      BEGIN
        -- Add billing_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'billing_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN billing_id UUID REFERENCES billing(id) ON DELETE SET NULL;
        END IF;

        -- Rename medical_aid_number to member_number if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'medical_aid_number') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'member_number') THEN
            ALTER TABLE medical_aid_claims RENAME COLUMN medical_aid_number TO member_number;
          END IF;
        END IF;

        -- Add member_number if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'member_number') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN member_number VARCHAR(100);
        END IF;

        -- Add approved_amount if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'approved_amount') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN approved_amount DECIMAL(10,2);
        END IF;

        -- Add rejection_reason if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'rejection_reason') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN rejection_reason TEXT;
        END IF;

        -- Add claim_data if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'claim_data') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN claim_data JSONB;
        END IF;

        -- Update submission_date and response_date to TIMESTAMP WITH TIME ZONE if they're DATE
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_date' AND data_type = 'date') THEN
          ALTER TABLE medical_aid_claims ALTER COLUMN submission_date TYPE TIMESTAMP WITH TIME ZONE USING submission_date::TIMESTAMP WITH TIME ZONE;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'response_date' AND data_type = 'date') THEN
          ALTER TABLE medical_aid_claims ALTER COLUMN response_date TYPE TIMESTAMP WITH TIME ZONE USING response_date::TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Remove appointment_id if it exists (replaced by billing_id)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'appointment_id') THEN
          ALTER TABLE medical_aid_claims DROP COLUMN IF EXISTS appointment_id;
        END IF;

        -- Remove response_notes if it exists (replaced by rejection_reason)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'response_notes') THEN
          ALTER TABLE medical_aid_claims DROP COLUMN IF EXISTS response_notes;
        END IF;

        -- Update status constraint to include new statuses
        ALTER TABLE medical_aid_claims DROP CONSTRAINT IF EXISTS medical_aid_claims_status_check;
        ALTER TABLE medical_aid_claims ADD CONSTRAINT medical_aid_claims_status_check 
          CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'rejected', 'paid'));

        -- Update default status
        ALTER TABLE medical_aid_claims ALTER COLUMN status SET DEFAULT 'draft';

        -- Make created_by nullable if it's not already
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'created_by' AND is_nullable = 'NO') THEN
          ALTER TABLE medical_aid_claims ALTER COLUMN created_by DROP NOT NULL;
        END IF;

        -- Make submission_date nullable if it's not already
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_date' AND is_nullable = 'NO') THEN
          ALTER TABLE medical_aid_claims ALTER COLUMN submission_date DROP NOT NULL;
        END IF;

        -- Create index on billing_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'medical_aid_claims' AND indexname = 'idx_claims_billing_id') THEN
          CREATE INDEX idx_claims_billing_id ON medical_aid_claims(billing_id);
        END IF;
      END $$;`);

    return statements;
  }

  private getTelemedicineSchemaStatements(): string[] {
    const statements: string[] = [];

    // Telemedicine Consultations Table
    statements.push(`CREATE TABLE IF NOT EXISTS telemedicine_consultations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consultation_type VARCHAR(20) NOT NULL DEFAULT 'video' CHECK (consultation_type IN ('video', 'audio', 'chat', 'hybrid')),
      meeting_room_id VARCHAR(255) UNIQUE,
      meeting_url TEXT,
      meeting_password VARCHAR(100),
      scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      actual_start_time TIMESTAMP WITH TIME ZONE,
      actual_end_time TIMESTAMP WITH TIME ZONE,
      duration_minutes INTEGER,
      connection_quality VARCHAR(20) CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
      doctor_connection_quality VARCHAR(20) CHECK (doctor_connection_quality IN ('excellent', 'good', 'fair', 'poor')),
      patient_joined BOOLEAN DEFAULT false,
      patient_join_time TIMESTAMP WITH TIME ZONE,
      doctor_joined BOOLEAN DEFAULT false,
      doctor_join_time TIMESTAMP WITH TIME ZONE,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'technical_issue')),
      cancellation_reason TEXT,
      technical_issues TEXT,
      patient_consent BOOLEAN DEFAULT false,
      consent_date TIMESTAMP WITH TIME ZONE,
      recording_enabled BOOLEAN DEFAULT false,
      recording_url TEXT,
      notes TEXT,
      satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
      satisfaction_feedback TEXT,
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Telemedicine Devices Table
    statements.push(`CREATE TABLE IF NOT EXISTS telemedicine_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('smartphone', 'tablet', 'laptop', 'desktop')),
      device_name VARCHAR(255),
      operating_system VARCHAR(50),
      browser VARCHAR(50),
      browser_version VARCHAR(50),
      internet_connection_type VARCHAR(20) CHECK (internet_connection_type IN ('wifi', 'mobile_data', 'ethernet', 'unknown')),
      average_bandwidth INTEGER,
      last_used TIMESTAMP WITH TIME ZONE,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Telemedicine Consents Table
    statements.push(`CREATE TABLE IF NOT EXISTS telemedicine_consents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      consent_type VARCHAR(30) NOT NULL CHECK (consent_type IN ('general_telehealth', 'video_recording', 'data_sharing', 'research')),
      consent_status VARCHAR(20) NOT NULL DEFAULT 'granted' CHECK (consent_status IN ('granted', 'denied', 'expired', 'revoked')),
      consent_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expiry_date TIMESTAMP WITH TIME ZONE,
      revoked_date TIMESTAMP WITH TIME ZONE,
      consent_document_url TEXT,
      ip_address INET,
      user_agent TEXT,
      witnessed_by UUID REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Telemedicine Technical Logs Table
    statements.push(`CREATE TABLE IF NOT EXISTS telemedicine_technical_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consultation_id UUID NOT NULL REFERENCES telemedicine_consultations(id) ON DELETE CASCADE,
      log_type VARCHAR(30) NOT NULL CHECK (log_type IN ('connection_issue', 'audio_issue', 'video_issue', 'bandwidth_issue', 'other')),
      severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      description TEXT NOT NULL,
      resolution TEXT,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Remote Patient Monitoring Table
    statements.push(`CREATE TABLE IF NOT EXISTS remote_patient_monitoring (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      monitoring_type VARCHAR(30) NOT NULL CHECK (monitoring_type IN ('blood_pressure', 'blood_glucose', 'weight', 'temperature', 'heart_rate', 'oxygen_saturation', 'other')),
      device_name VARCHAR(255),
      device_model VARCHAR(255),
      reading_value DECIMAL(10,2),
      reading_unit VARCHAR(20),
      reading_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      uploaded_by UUID REFERENCES users(id),
      device_synced BOOLEAN DEFAULT false,
      notes TEXT,
      alert_triggered BOOLEAN DEFAULT false,
      alert_severity VARCHAR(20) CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Telemedicine Prescriptions Table
    statements.push(`CREATE TABLE IF NOT EXISTS telemedicine_prescriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consultation_id UUID NOT NULL REFERENCES telemedicine_consultations(id) ON DELETE CASCADE,
      prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
      e_signature_patient TEXT,
      e_signature_doctor TEXT,
      signed_by_patient_at TIMESTAMP WITH TIME ZONE,
      signed_by_doctor_at TIMESTAMP WITH TIME ZONE,
      signature_method VARCHAR(20) CHECK (signature_method IN ('digital_pen', 'touch', 'click_to_sign')),
      is_valid BOOLEAN DEFAULT false,
      pdf_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_appointment_id ON telemedicine_consultations(appointment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_patient_id ON telemedicine_consultations(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_doctor_id ON telemedicine_consultations(doctor_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_status ON telemedicine_consultations(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_scheduled_start_time ON telemedicine_consultations(scheduled_start_time)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_meeting_room_id ON telemedicine_consultations(meeting_room_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_devices_patient_id ON telemedicine_devices(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consents_patient_id ON telemedicine_consents(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_consents_patient_status ON telemedicine_consents(patient_id, consent_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_technical_logs_consultation_id ON telemedicine_technical_logs(consultation_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_patient_id ON remote_patient_monitoring(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_patient_date ON remote_patient_monitoring(patient_id, reading_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_type ON remote_patient_monitoring(monitoring_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_telemedicine_prescriptions_consultation_id ON telemedicine_prescriptions(consultation_id)`);

    // Triggers for updated_at
    statements.push(`DROP TRIGGER IF EXISTS update_telemedicine_consultations_updated_at ON telemedicine_consultations`);
    statements.push(`CREATE TRIGGER update_telemedicine_consultations_updated_at
      BEFORE UPDATE ON telemedicine_consultations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_telemedicine_devices_updated_at ON telemedicine_devices`);
    statements.push(`CREATE TRIGGER update_telemedicine_devices_updated_at
      BEFORE UPDATE ON telemedicine_devices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_telemedicine_consents_updated_at ON telemedicine_consents`);
    statements.push(`CREATE TRIGGER update_telemedicine_consents_updated_at
      BEFORE UPDATE ON telemedicine_consents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_telemedicine_technical_logs_updated_at ON telemedicine_technical_logs`);
    statements.push(`CREATE TRIGGER update_telemedicine_technical_logs_updated_at
      BEFORE UPDATE ON telemedicine_technical_logs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_remote_patient_monitoring_updated_at ON remote_patient_monitoring`);
    statements.push(`CREATE TRIGGER update_remote_patient_monitoring_updated_at
      BEFORE UPDATE ON remote_patient_monitoring
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_telemedicine_prescriptions_updated_at ON telemedicine_prescriptions`);
    statements.push(`CREATE TRIGGER update_telemedicine_prescriptions_updated_at
      BEFORE UPDATE ON telemedicine_prescriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    return statements;
  }

  private getAnalyticsSchemaStatements(): string[] {
    const statements: string[] = [];

    // Report Templates Table
    statements.push(`CREATE TABLE IF NOT EXISTS report_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('financial', 'clinical', 'operational', 'custom')),
      category VARCHAR(100),
      config JSONB DEFAULT '{}'::jsonb,
      query_config JSONB DEFAULT '{}'::jsonb,
      visualization_config JSONB DEFAULT '{}'::jsonb,
      is_public BOOLEAN DEFAULT false,
      is_default BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id),
      shared_with_roles TEXT[] DEFAULT '{}',
      usage_count INTEGER DEFAULT 0,
      last_used TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Scheduled Reports Table
    statements.push(`CREATE TABLE IF NOT EXISTS scheduled_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
      schedule_config JSONB DEFAULT '{}'::jsonb,
      recipients TEXT[] DEFAULT '{}',
      recipient_roles TEXT[] DEFAULT '{}',
      format VARCHAR(20) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv', 'json')),
      filters JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      last_run TIMESTAMP WITH TIME ZONE,
      next_run TIMESTAMP WITH TIME ZONE,
      run_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Report Executions Table
    statements.push(`CREATE TABLE IF NOT EXISTS report_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
      scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,
      execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('manual', 'scheduled', 'api')),
      executed_by UUID REFERENCES users(id),
      execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      duration_ms INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      filters_applied JSONB DEFAULT '{}'::jsonb,
      result_count INTEGER,
      file_url TEXT,
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Clinical Outcomes Table
    statements.push(`CREATE TABLE IF NOT EXISTS clinical_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN ('treatment_response', 'readmission', 'complication', 'mortality', 'quality_of_life', 'other')),
      condition VARCHAR(255),
      snomed_code VARCHAR(50),
      baseline_date DATE,
      outcome_date DATE,
      outcome_value DECIMAL(10,2),
      outcome_unit VARCHAR(50),
      outcome_status VARCHAR(50) CHECK (outcome_status IN ('improved', 'stable', 'worsened', 'resolved', 'ongoing')),
      severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
      related_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      related_prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
      related_lab_order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
      notes TEXT,
      recorded_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Analytics Metrics Table
    statements.push(`CREATE TABLE IF NOT EXISTS analytics_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      metric_name VARCHAR(100) NOT NULL,
      metric_category VARCHAR(50) CHECK (metric_category IN ('financial', 'clinical', 'operational')),
      metric_date DATE NOT NULL,
      metric_value DECIMAL(15,2),
      metric_unit VARCHAR(50),
      dimensions JSONB DEFAULT '{}'::jsonb,
      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      calculation_method VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Report Favorites Table
    statements.push(`CREATE TABLE IF NOT EXISTS report_favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
      custom_name VARCHAR(255),
      "order" INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, report_template_id)
    )`);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_templates_report_type ON report_templates(report_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template_id ON scheduled_reports(template_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_executions_executed_by ON report_executions(executed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_executions_execution_time ON report_executions(execution_time)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_executions_template_id ON report_executions(report_template_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_executions_scheduled_id ON report_executions(scheduled_report_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_patient_id ON clinical_outcomes(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_outcome_type ON clinical_outcomes(outcome_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_outcome_date ON clinical_outcomes(outcome_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_name ON analytics_metrics(metric_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_date ON analytics_metrics(metric_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_analytics_metrics_category ON analytics_metrics(metric_category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_report_favorites_user_id ON report_favorites(user_id)`);

    // Triggers for updated_at
    statements.push(`DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates`);
    statements.push(`CREATE TRIGGER update_report_templates_updated_at
      BEFORE UPDATE ON report_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON scheduled_reports`);
    statements.push(`CREATE TRIGGER update_scheduled_reports_updated_at
      BEFORE UPDATE ON scheduled_reports
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_report_executions_updated_at ON report_executions`);
    statements.push(`CREATE TRIGGER update_report_executions_updated_at
      BEFORE UPDATE ON report_executions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_clinical_outcomes_updated_at ON clinical_outcomes`);
    statements.push(`CREATE TRIGGER update_clinical_outcomes_updated_at
      BEFORE UPDATE ON clinical_outcomes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`DROP TRIGGER IF EXISTS update_analytics_metrics_updated_at ON analytics_metrics`);
    statements.push(`CREATE TRIGGER update_analytics_metrics_updated_at
      BEFORE UPDATE ON analytics_metrics
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`);

    return statements;
  }

  private getPrescriptionDownloadSchemaStatements(): string[] {
    const statements: string[] = [];

    // Prescription Downloads Audit Table
    statements.push(`CREATE TABLE IF NOT EXISTS prescription_downloads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      downloaded_by UUID NOT NULL,
      downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('doctor', 'patient', 'pharmacist', 'nurse', 'admin')),
      ip_address INET,
      user_agent TEXT,
      file_name VARCHAR(255),
      file_size_bytes INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    // Indexes for performance
    statements.push(`CREATE INDEX IF NOT EXISTS idx_prescription_downloads_prescription_id ON prescription_downloads(prescription_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_prescription_downloads_downloaded_by ON prescription_downloads(downloaded_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_prescription_downloads_downloaded_at ON prescription_downloads(downloaded_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_prescription_downloads_user_type ON prescription_downloads(user_type)`);

    return statements;
  }

  private getIcd10MappingStatements(): string[] {
    return [
      `
        CREATE TABLE snomed_icd10_mappings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          concept_id VARCHAR(50) NOT NULL,
          concept_fsn TEXT,
          target_code VARCHAR(20) NOT NULL,
          target_display TEXT,
          map_group SMALLINT DEFAULT 1,
          map_priority SMALLINT DEFAULT 1,
          map_rule TEXT,
          map_advice TEXT,
          map_status VARCHAR(100),
          map_category_id VARCHAR(20),
          module_id VARCHAR(50),
          map_source VARCHAR(100),
          effective_time DATE,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `,
      `
        CREATE UNIQUE INDEX idx_snomed_icd10_unique_map
        ON snomed_icd10_mappings (concept_id, target_code, map_group, map_priority)
      `,
      `
        CREATE INDEX idx_snomed_icd10_concept
        ON snomed_icd10_mappings (concept_id)
      `,
      `
        CREATE INDEX idx_snomed_icd10_target
        ON snomed_icd10_mappings (target_code)
      `,
      `
        CREATE INDEX idx_snomed_icd10_active_concept
        ON snomed_icd10_mappings (active, concept_id)
      `,
      `
        CREATE TABLE icd10_mapping_metadata (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          release_label VARCHAR(150) NOT NULL,
          effective_time DATE,
          source_zip TEXT,
          total_rows INTEGER,
          import_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          import_completed_at TIMESTAMP WITH TIME ZONE,
          notes TEXT
        )
      `,
      `
        CREATE UNIQUE INDEX idx_icd10_mapping_metadata_release
        ON icd10_mapping_metadata (release_label)
      `,
      `
        CREATE TRIGGER update_snomed_icd10_mappings_updated_at
        BEFORE UPDATE ON snomed_icd10_mappings
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column()
      `,
      `
        CREATE TRIGGER update_icd10_mapping_metadata_updated_at
        BEFORE UPDATE ON icd10_mapping_metadata
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column()
      `,
    ];
  }

  private getTriggerStatements(): string[] {
    return [
      `CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_vitals_updated_at BEFORE UPDATE ON vitals
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON triage_assessments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_nursing_notes_updated_at BEFORE UPDATE ON nursing_notes
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON billing
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_medical_aid_claims_updated_at BEFORE UPDATE ON medical_aid_claims
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_orders_updated_at BEFORE UPDATE ON lab_orders
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON lab_tests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_order_sets_updated_at BEFORE UPDATE ON lab_order_sets
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_critical_alerts_updated_at BEFORE UPDATE ON critical_result_alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_test_catalog_updated_at BEFORE UPDATE ON lab_test_catalog
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_drug_interactions_updated_at BEFORE UPDATE ON drug_interactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_modalities_updated_at BEFORE UPDATE ON imaging_modalities
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_study_types_updated_at BEFORE UPDATE ON imaging_study_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_orders_updated_at BEFORE UPDATE ON imaging_orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_studies_updated_at BEFORE UPDATE ON imaging_studies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_reports_updated_at BEFORE UPDATE ON imaging_reports
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_report_acknowledgements_updated_at BEFORE UPDATE ON imaging_report_acknowledgements
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_report_templates_updated_at BEFORE UPDATE ON imaging_report_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_maternity_enrollments_updated_at BEFORE UPDATE ON maternity_enrollments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_anc_visits_updated_at BEFORE UPDATE ON anc_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_ultrasound_scans_updated_at BEFORE UPDATE ON ultrasound_scans
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_postnatal_visits_updated_at BEFORE UPDATE ON postnatal_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tests_updated_at BEFORE UPDATE ON hiv_tests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_sti_tests_updated_at BEFORE UPDATE ON sti_tests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_care_enrollments_updated_at BEFORE UPDATE ON hiv_care_enrollments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_initiation_details_updated_at BEFORE UPDATE ON hiv_art_initiation_details
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_clinical_visits_updated_at BEFORE UPDATE ON hiv_clinical_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_tb_screenings_updated_at BEFORE UPDATE ON tb_screenings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_cervical_cancer_screenings_updated_at BEFORE UPDATE ON cervical_cancer_screenings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_who_staging_updated_at BEFORE UPDATE ON hiv_who_staging
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_visit_types_updated_at BEFORE UPDATE ON hiv_visit_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_bmi_classifications_updated_at BEFORE UPDATE ON hiv_bmi_classifications
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_pregnancy_lactating_status_updated_at BEFORE UPDATE ON hiv_pregnancy_lactating_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_family_planning_methods_updated_at BEFORE UPDATE ON hiv_family_planning_methods
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_functional_status_updated_at BEFORE UPDATE ON hiv_functional_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tb_screening_status_updated_at BEFORE UPDATE ON hiv_tb_screening_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tb_investigation_results_updated_at BEFORE UPDATE ON hiv_tb_investigation_results
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_opportunistic_infections_updated_at BEFORE UPDATE ON hiv_opportunistic_infections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_oi_sub_categories_updated_at BEFORE UPDATE ON hiv_oi_sub_categories
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_mental_health_results_updated_at BEFORE UPDATE ON hiv_mental_health_results
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_mental_health_management_updated_at BEFORE UPDATE ON hiv_mental_health_management
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tpt_eligibility_updated_at BEFORE UPDATE ON hiv_tpt_eligibility
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tpt_status_updated_at BEFORE UPDATE ON hiv_tpt_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_signs_updated_at BEFORE UPDATE ON hiv_cryptococcal_signs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_status_updated_at BEFORE UPDATE ON hiv_cryptococcal_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_treatment_updated_at BEFORE UPDATE ON hiv_cryptococcal_treatment
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_status_updated_at BEFORE UPDATE ON hiv_arv_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_initiation_category_updated_at BEFORE UPDATE ON hiv_art_initiation_category
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_adverse_events_status_updated_at BEFORE UPDATE ON hiv_adverse_events_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_reasons_not_on_updated_at BEFORE UPDATE ON hiv_arv_reasons_not_on
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_reasons_start_updated_at BEFORE UPDATE ON hiv_arv_reasons_start
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_change_stop_reasons_updated_at BEFORE UPDATE ON hiv_arv_change_stop_reasons
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_visit_status_updated_at BEFORE UPDATE ON hiv_visit_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_final_outcome_updated_at BEFORE UPDATE ON hiv_final_outcome
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_regimens_updated_at BEFORE UPDATE ON hiv_art_regimens
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_precancerous_lesion_treatment_updated_at BEFORE UPDATE ON hiv_precancerous_lesion_treatment
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON financial_transactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_financial_line_items_updated_at BEFORE UPDATE ON financial_line_items
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_financial_payments_updated_at BEFORE UPDATE ON financial_payments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_financial_claims_updated_at BEFORE UPDATE ON financial_claims
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_financial_reconciliation_logs_updated_at BEFORE UPDATE ON financial_reconciliation_logs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];
  }

  private getSnomedUpgradeStatements(): string[] {
    return [
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(50)`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_long_name TEXT`,
      `ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_lab_orders_snomed_concept ON lab_orders(snomed_concept_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lab_orders_loinc_code ON lab_orders(loinc_code)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_codes JSONB DEFAULT '{}'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_orders_snomed_concept ON orders(snomed_concept_id)`,
      `ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`,
      `ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT`,
      `ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50)`,
      `ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_imaging_orders_snomed_concept ON imaging_orders(snomed_concept_id)`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_term TEXT`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS reason_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS symptom_snomed_codes JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS diagnostic_snomed_codes JSONB DEFAULT '[]'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_reason_snomed ON cardiology_encounters(reason_snomed_code)`,
      `ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_code VARCHAR(50)`,
      `ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_term TEXT`,
      `ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE oncology_cases ADD COLUMN IF NOT EXISTS primary_diagnosis_snomed_definition_status VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_oncology_cases_primary_dx_snomed ON oncology_cases(primary_diagnosis_snomed_code)`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_code VARCHAR(50)`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_term TEXT`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS regimen_snomed_definition_status VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_oncology_regimens_snomed ON oncology_regimens(regimen_snomed_code)`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_code VARCHAR(50)`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_term TEXT`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS event_snomed_definition_status VARCHAR(50)`,
      `CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_snomed ON oncology_adverse_events(event_snomed_code)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_term TEXT`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS structure_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS structure_snomed_term TEXT`,
      `ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS observation_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS observation_snomed_term TEXT`,
      `ALTER TABLE ophthalmology_procedures ADD COLUMN IF NOT EXISTS procedure_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_procedures ADD COLUMN IF NOT EXISTS procedure_snomed_term TEXT`,
      `ALTER TABLE ophthalmology_follow_ups ADD COLUMN IF NOT EXISTS reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE ophthalmology_follow_ups ADD COLUMN IF NOT EXISTS reason_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS opportunistic_infections_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_investigation_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_reason_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_result_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_result_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_management_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_management_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS adverse_events_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS adherence_barriers_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS adherence_tools_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS support_systems_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS session_outcome_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS session_outcome_snomed_term TEXT`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_reason_snomed_term TEXT`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS symptom_snomed_codes JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS diagnosis_snomed_code VARCHAR(50)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS diagnosis_snomed_term TEXT`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS treatment_snomed_code VARCHAR(50)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS treatment_snomed_term TEXT`,
      `ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS previous_complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS current_complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50)`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS vitals_source_vital_id UUID REFERENCES vitals(id)`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS vitals_auto_populated_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS vitals_overridden BOOLEAN DEFAULT false`,
      `ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS vitals_override_reason TEXT`,
      `ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS indication_snomed_code VARCHAR(50)`,
      `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS indication_snomed_term TEXT`,
      `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS indication_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS indication_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50)`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS danger_signs_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50)`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS vitals_source_vital_id UUID REFERENCES vitals(id)`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS vitals_auto_populated_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS vitals_overridden BOOLEAN DEFAULT false`,
      `ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS vitals_override_reason TEXT`,
      `ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50)`,
      `ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT`,
      `ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50)`,
      `ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT`,
      `ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_code VARCHAR(50)`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_term TEXT`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS outcomes_snomed JSONB DEFAULT '[]'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_anc_visits_vitals_source ON anc_visits(vitals_source_vital_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_postnatal_visits_vitals_source ON postnatal_visits(vitals_source_vital_id)`,
      `CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_triage_chief_complaint_snomed ON triage_assessments(chief_complaint_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_triage_observations_snomed ON triage_assessments USING GIN(observations_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_snomed ON prescriptions(medication_name_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_nursing_notes_observations_snomed ON nursing_notes USING GIN(observations_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_nursing_notes_interventions_snomed ON nursing_notes USING GIN(interventions_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_nursing_notes_outcomes_snomed ON nursing_notes USING GIN(outcomes_snomed)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_code VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_term TEXT`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS via_result_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS pap_result_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS hpv_result_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS colposcopy_result_snomed JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_code VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_term TEXT`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS treatment_provided_snomed JSONB DEFAULT '[]'::jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_method_snomed ON cervical_cancer_screenings(screening_method_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_result_snomed ON cervical_cancer_screenings(screening_result_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_biopsy_snomed ON cervical_cancer_screenings(biopsy_result_snomed_code)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_via_result_snomed ON cervical_cancer_screenings USING GIN(via_result_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_pap_result_snomed ON cervical_cancer_screenings USING GIN(pap_result_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_hpv_result_snomed ON cervical_cancer_screenings USING GIN(hpv_result_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_colposcopy_result_snomed ON cervical_cancer_screenings USING GIN(colposcopy_result_snomed)`,
      `CREATE INDEX IF NOT EXISTS idx_cervical_screenings_treatment_snomed ON cervical_cancer_screenings USING GIN(treatment_provided_snomed)`
    ];
  }

  private getHivTestingUpgradeStatements(): string[] {
    return [
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_term TEXT`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_module_id VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_definition_status VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_code VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_term TEXT`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_stage VARCHAR(50) DEFAULT 'screening'`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_reason VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_approach VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_location VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_cadre VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_type VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS kit_type VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS dual_kit_used BOOLEAN DEFAULT false`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS self_test_reported BOOLEAN DEFAULT false`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS self_test_confirmed BOOLEAN DEFAULT false`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_test_performed BOOLEAN DEFAULT false`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_result VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_kit_lot VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS recency_kit_expiry DATE`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS partner_notification_status VARCHAR(50)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS linkage_action VARCHAR(100)`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS linkage_completed BOOLEAN DEFAULT false`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS stis_screened JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS stis_results JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS follow_up_actions JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS testing_context JSONB DEFAULT '{}'::jsonb`,
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS next_test_due_date DATE`,
      `
        CREATE TABLE IF NOT EXISTS sti_tests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          hiv_test_id UUID REFERENCES hiv_tests(id) ON DELETE SET NULL,
          test_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          infection_type VARCHAR(50) NOT NULL,
          infection_snomed_code VARCHAR(50),
          infection_snomed_term TEXT,
          test_type VARCHAR(100),
          test_method VARCHAR(100),
          test_snomed_code VARCHAR(50),
          test_snomed_term TEXT,
          specimen_type VARCHAR(100),
          anatomic_site VARCHAR(100),
          result VARCHAR(50) CHECK (result IN ('positive','negative','reactive','non_reactive','indeterminate','pending','invalid')),
          result_value VARCHAR(255),
          result_unit VARCHAR(50),
          treatment_provided BOOLEAN DEFAULT false,
          treatment_regimen TEXT,
          treatment_date DATE,
          notes TEXT,
          ordered_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `,
      `ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS infection_snomed_code VARCHAR(50)`,
      `ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS infection_snomed_term TEXT`,
      `ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS test_snomed_code VARCHAR(50)`,
      `ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS test_snomed_term TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_sti_tests_patient_id ON sti_tests(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sti_tests_infection_type ON sti_tests(infection_type)`,
      `CREATE INDEX IF NOT EXISTS idx_sti_tests_result ON sti_tests(result)`,
      `CREATE TRIGGER update_sti_tests_updated_at BEFORE UPDATE ON sti_tests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];
  }

  private getHivRegimenHardeningStatements(): string[] {
    return [
      `
        CREATE TABLE IF NOT EXISTS hiv_regimen_rule_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          version_code VARCHAR(80) UNIQUE NOT NULL,
          guideline_source VARCHAR(255) NOT NULL,
          guideline_version VARCHAR(120),
          country_context VARCHAR(120) DEFAULT 'Zimbabwe',
          effective_from DATE DEFAULT CURRENT_DATE,
          is_active BOOLEAN DEFAULT false,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS hiv_regimen_contraindication_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_key VARCHAR(120) UNIQUE NOT NULL,
          version_id UUID REFERENCES hiv_regimen_rule_versions(id) ON DELETE CASCADE,
          regimen_code VARCHAR(20),
          domain VARCHAR(30) NOT NULL CHECK (domain IN ('pregnancy', 'tb_ddi', 'renal', 'hepatic', 'general')),
          severity VARCHAR(10) NOT NULL CHECK (severity IN ('block', 'warn')),
          condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          message TEXT NOT NULL,
          recommended_action TEXT,
          guideline_reference TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_version ON hiv_regimen_contraindication_rules(version_id)`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_regimen ON hiv_regimen_contraindication_rules(regimen_code)`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_domain ON hiv_regimen_contraindication_rules(domain)`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_severity ON hiv_regimen_contraindication_rules(severity)`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_active ON hiv_regimen_contraindication_rules(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_regimen_rules_condition_gin ON hiv_regimen_contraindication_rules USING GIN(condition_json)`,
      `ALTER TABLE hiv_arv_change_requests ADD COLUMN IF NOT EXISTS regimen_safety_summary JSONB DEFAULT '{}'::jsonb`,
      `ALTER TABLE hiv_arv_change_requests ADD COLUMN IF NOT EXISTS regimen_safety_blocked BOOLEAN DEFAULT false`,
      `CREATE TRIGGER update_hiv_regimen_rule_versions_updated_at BEFORE UPDATE ON hiv_regimen_rule_versions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_regimen_contra_rules_updated_at BEFORE UPDATE ON hiv_regimen_contraindication_rules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];
  }

  private async applySnomedUpgrades(tenantDb: DataSource): Promise<void> {
    for (const statement of this.getSnomedUpgradeStatements()) {
      const sql = statement.trim();
      if (!sql) {
        continue;
      }
      try {
        await tenantDb.query(sql);
      } catch (error) {
        this.logger.warn(
          `SNOMED schema statement failed (${sql.substring(0, 80)}…): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  public async applySnomedUpgradesToTenant(databaseName: string): Promise<void> {
    const connectionString = this.generateConnectionString(databaseName);
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      await this.applySnomedUpgrades(tenantDataSource);
      await this.applyHivTestingUpgrades(tenantDataSource);
    } catch (error) {
      this.logger.warn(
        `Failed to ensure SNOMED schema for database ${databaseName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }

  private async applyHivTestingUpgrades(tenantDb: DataSource): Promise<void> {
    for (const statement of this.getHivTestingUpgradeStatements()) {
      const sql = statement.trim();
      if (!sql) {
        continue;
      }
      try {
        await tenantDb.query(sql);
      } catch (error) {
        this.logger.warn(
          `HIV/STI schema statement failed (${sql.substring(0, 80)}…): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async seedHivRegimenContraindicationMatrix(tenantDataSource: DataSource): Promise<void> {
    const versionCode = 'WHO_ZW_ART_2026Q1';
    const guidelineSource =
      'WHO Consolidated HIV Guidelines + Zimbabwe HIV Prevention, Treatment and Care Guidelines';

    try {
      await tenantDataSource.query(
        `
        INSERT INTO hiv_regimen_rule_versions (
          version_code, guideline_source, guideline_version, country_context, is_active, notes
        )
        VALUES ($1, $2, $3, 'Zimbabwe', true, $4)
        ON CONFLICT (version_code)
        DO UPDATE SET
          guideline_source = EXCLUDED.guideline_source,
          guideline_version = EXCLUDED.guideline_version,
          country_context = EXCLUDED.country_context,
          is_active = true,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `,
        [
          versionCode,
          guidelineSource,
          '2026-Q1',
          'Baseline regimen contraindication matrix for pregnancy, TB DDI, renal, and hepatic constraints.',
        ],
      );

      await tenantDataSource.query(
        `UPDATE hiv_regimen_rule_versions SET is_active = (version_code = $1), updated_at = NOW()`,
        [versionCode],
      );

      const versionRows = await tenantDataSource.query(
        `SELECT id FROM hiv_regimen_rule_versions WHERE version_code = $1 LIMIT 1`,
        [versionCode],
      );
      const versionId = versionRows[0]?.id;
      if (!versionId) {
        return;
      }

      const rules = [
        {
          ruleKey: 'pregnancy_status_required_female_reproductive_age',
          regimenCode: null,
          domain: 'pregnancy',
          severity: 'block',
          condition: {
            gender_in: ['female'],
            min_age: 15,
            max_age: 49,
            requires_data: ['pregnancy_status'],
          },
          message:
            'Pregnancy/lactation status is required before regimen change for women of reproductive age.',
          action: 'Capture pregnancy/lactation status first, then retry regimen selection.',
          ref: 'WHO HIV service delivery package (pregnancy status documented at clinical decision points).',
        },
        {
          ruleKey: 'renal_data_required_for_tdf_regimens',
          regimenCode: null,
          domain: 'renal',
          severity: 'block',
          condition: {
            requires_components_any: ['TDF'],
            requires_data: ['creatinine_result'],
          },
          message: 'Creatinine result is required before selecting a TDF-containing regimen.',
          action: 'Order or capture renal function result before regimen switch.',
          ref: 'WHO ART toxicity monitoring recommendations.',
        },
        {
          ruleKey: 'hepatic_data_required_for_nvp_regimens',
          regimenCode: null,
          domain: 'hepatic',
          severity: 'block',
          condition: {
            requires_components_any: ['NVP'],
            requires_data: ['alt_result'],
          },
          message: 'ALT result is required before selecting an NVP-containing regimen.',
          action: 'Capture hepatic function result before regimen switch.',
          ref: 'WHO ART toxicity monitoring recommendations.',
        },
        {
          ruleKey: 'tb_rifampicin_with_atv_r_block',
          regimenCode: null,
          domain: 'tb_ddi',
          severity: 'block',
          condition: {
            requires_components_any: ['ATV/R'],
            tb_treatment_required: true,
            tb_meds_any: ['rifampicin', 'rifampin'],
          },
          message:
            'ATV/r with rifampicin-based TB therapy is contraindicated due to major drug interaction risk.',
          action: 'Choose an alternative ART strategy compatible with rifampicin-based TB treatment.',
          ref: 'WHO guidance on ART/TB co-treatment drug interactions.',
        },
        {
          ruleKey: 'tb_rifampicin_with_dtg_warn',
          regimenCode: null,
          domain: 'tb_ddi',
          severity: 'warn',
          condition: {
            requires_components_any: ['DTG'],
            tb_treatment_required: true,
            tb_meds_any: ['rifampicin', 'rifampin'],
          },
          message:
            'DTG with rifampicin co-treatment requires dosing review and close follow-up per protocol.',
          action: 'Apply DTG + rifampicin co-treatment dosing protocol and document plan.',
          ref: 'WHO guidance on ART/TB co-treatment with integrase inhibitors.',
        },
        {
          ruleKey: 'tb_rifampicin_with_lpvr_warn',
          regimenCode: null,
          domain: 'tb_ddi',
          severity: 'warn',
          condition: {
            requires_components_any: ['LPV/R'],
            tb_treatment_required: true,
            tb_meds_any: ['rifampicin', 'rifampin'],
          },
          message:
            'LPV/r with rifampicin requires protocol-level adjustment and intensified monitoring.',
          action:
            'Review TB/ART co-treatment protocol before confirming regimen change and document plan.',
          ref: 'WHO guidance on boosted PI co-treatment with rifampicin.',
        },
        {
          ruleKey: 'renal_impairment_tdf_warn',
          regimenCode: null,
          domain: 'renal',
          severity: 'warn',
          condition: {
            requires_components_any: ['TDF'],
            creatinine_min: 1.5,
          },
          message:
            'Renal risk warning: elevated creatinine with TDF-containing regimen needs clinical review.',
          action:
            'Consider renal-sparing alternative or enhanced renal monitoring per local protocol.',
          ref: 'WHO ART toxicity and renal monitoring recommendations.',
        },
        {
          ruleKey: 'severe_renal_impairment_tdf_block',
          regimenCode: null,
          domain: 'renal',
          severity: 'block',
          condition: {
            requires_components_any: ['TDF'],
            creatinine_min: 2.0,
          },
          message:
            'TDF-containing regimen is blocked at this renal function level unless specialist override is documented.',
          action: 'Select a non-TDF regimen and document renal safety rationale.',
          ref: 'WHO ART toxicity and renal monitoring recommendations.',
        },
        {
          ruleKey: 'high_alt_nvp_block',
          regimenCode: null,
          domain: 'hepatic',
          severity: 'block',
          condition: {
            requires_components_any: ['NVP'],
            alt_min: 120,
          },
          message: 'NVP-containing regimen is blocked due to elevated ALT (hepatic risk).',
          action: 'Select alternative regimen and manage hepatic abnormality before switch.',
          ref: 'WHO ART toxicity guidance for NNRTI-related hepatotoxicity risk.',
        },
      ];

      for (const rule of rules) {
        await tenantDataSource.query(
          `
          INSERT INTO hiv_regimen_contraindication_rules (
            rule_key, version_id, regimen_code, domain, severity,
            condition_json, message, recommended_action, guideline_reference, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, true)
          ON CONFLICT (rule_key)
          DO UPDATE SET
            version_id = EXCLUDED.version_id,
            regimen_code = EXCLUDED.regimen_code,
            domain = EXCLUDED.domain,
            severity = EXCLUDED.severity,
            condition_json = EXCLUDED.condition_json,
            message = EXCLUDED.message,
            recommended_action = EXCLUDED.recommended_action,
            guideline_reference = EXCLUDED.guideline_reference,
            is_active = true,
            updated_at = NOW()
        `,
          [
            rule.ruleKey,
            versionId,
            rule.regimenCode,
            rule.domain,
            rule.severity,
            JSON.stringify(rule.condition),
            rule.message,
            rule.action,
            rule.ref,
          ],
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to seed HIV regimen contraindication matrix: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  public async applyHivTestingUpgradesToTenant(databaseName: string): Promise<void> {
    const connectionString = this.generateConnectionString(databaseName);
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      await this.applyHivTestingUpgrades(tenantDataSource);
    } catch (error) {
      this.logger.warn(
        `Failed to ensure HIV/STI schema for database ${databaseName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }

  private async seedLookupTables(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding HIV lookup tables with initial data...');
    
    try {
      // Seed Visit Types
      await tenantDataSource.query(`
        INSERT INTO hiv_visit_types (code, name, description, display_order) VALUES
        ('A', 'Present Self/conventional care (not in a DSD model)', NULL, 1),
        ('B', 'Sent Care Giver / Treatment Supporter (not in DSD model)', NULL, 2),
        ('C', 'Visit made at another clinic', NULL, 3),
        ('D', 'oMalayitsha / Cross Border Transport', NULL, 4),
        ('E', 'CARG (Family, KPs, General Population)', NULL, 5),
        ('F', 'Clubs (Teen, Carer & Child, Post partum)', NULL, 6),
        ('G', 'Fast Track', NULL, 7),
        ('H', 'Outreach by Facility HCW', NULL, 8),
        ('I', 'Drop in Centre', NULL, 9),
        ('J', 'Out of Facility Community ART Distribution (OFCAD)', NULL, 10),
        ('K', 'Private Pharmacy', NULL, 11),
        ('L', 'Other, Specify', NULL, 12)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed BMI Classifications
      await tenantDataSource.query(`
        INSERT INTO hiv_bmi_classifications (code, name, min_bmi, max_bmi, display_order) VALUES
        ('UW', 'Underweight', 0, 18.4, 1),
        ('NW', 'Normal weight', 18.5, 24.9, 2),
        ('PO', 'Pre-obesity', 25.0, 29.9, 3),
        ('Ob1', 'Obesity class I', 30.0, 34.9, 4),
        ('Ob2', 'Obesity class II', 35.0, 39.9, 5),
        ('Ob3', 'Obesity class III', 40.0, NULL, 6)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Pregnancy/Lactating Status
      await tenantDataSource.query(`
        INSERT INTO hiv_pregnancy_lactating_status (code, name, display_order) VALUES
        ('P', 'Pregnant', 1),
        ('EFF', 'Exclusive Formula Feeding', 2),
        ('MF', 'Mixed Feeding (Below 6 Months)', 3),
        ('BFCF', 'Breast Feeding & Complementary Feeding', 4),
        ('SBF', 'Stopped Breastfeeding', 5),
        ('NPL', 'Neither Pregnant nor lactating (for women)', 6),
        ('N/A', 'Not Applicable (for men & minors)', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Family Planning Methods
      await tenantDataSource.query(`
        INSERT INTO hiv_family_planning_methods (code, name, display_order) VALUES
        ('M', 'Implants', 1),
        ('Z', 'Sterilization', 2),
        ('A', 'Abstinence', 3),
        ('C', 'Condom', 4),
        ('O', 'Not using', 5),
        ('T', 'Traditional/Withdrawal', 6),
        ('P', 'Pills', 7),
        ('L', 'IUD', 8),
        ('J', 'Injections (e.g Depo)', 9),
        ('D', 'Dual Method', 10)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Functional Status
      await tenantDataSource.query(`
        INSERT INTO hiv_functional_status (code, name, display_order) VALUES
        ('W', 'Work/School', 1),
        ('A', 'Ambulatory', 2),
        ('B', 'Bedridden', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed HIV Testing Service Points
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_service_points (code, name, display_order) VALUES
        ('OPD', 'Outpatient Department (OPD)', 1),
        ('IPD', 'Inpatient Ward', 2),
        ('MCH', 'MCH / ANC Clinic', 3),
        ('ART', 'ART Clinic', 4),
        ('VCT', 'VCT / HTC Room', 5)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed HIV Testing Outreach / Campaigns
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_outreach_events (code, name, display_order) VALUES
        ('NONE', 'No outreach (facility-based)', 1),
        ('COMMUNITY', 'Community outreach', 2),
        ('MOBCLINIC', 'Mobile clinic', 3),
        ('CAMPAIGN', 'Campaign / special event', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Partner Services
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_partner_services (code, name, display_order) VALUES
        ('OFF', 'Offered', 1),
        ('ACC', 'Accepted', 2),
        ('DEC', 'Declined', 3),
        ('NA', 'Not applicable', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Linkage Actions
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_linkage_actions (code, name, display_order) VALUES
        ('ART_INIT', 'ART initiated', 1),
        ('ART_REF', 'Referred to ART clinic', 2),
        ('PREP', 'PrEP initiated', 3),
        ('PEP', 'PEP initiated', 4),
        ('COUNS', 'Counselling only', 5)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed STI Test Methods
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_sti_methods (code, name, display_order) VALUES
        ('DUAL', 'Dual HIV/STI rapid kit', 1),
        ('RDT', 'Rapid test', 2),
        ('NAAT', 'NAAT / PCR', 3),
        ('CULT', 'Culture', 4),
        ('OTHER', 'Other method', 5)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed STI Specimens
      await tenantDataSource.query(`
        INSERT INTO hiv_testing_sti_specimens (code, name, display_order) VALUES
        ('URETHRAL', 'Urethral swab', 1),
        ('CERVICAL', 'Cervical swab', 2),
        ('VAGINAL', 'Vaginal swab', 3),
        ('URINE', 'Urine', 4),
        ('BLOOD', 'Blood', 5),
        ('OTHER', 'Other site', 6)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TB Screening Status
      await tenantDataSource.query(`
        INSERT INTO hiv_tb_screening_status (code, name, display_order) VALUES
        ('Y', 'Screened and has no signs', 1),
        ('S', 'Presumptive - if there are signs', 2),
        ('ON', 'On TB Treatment', 3),
        ('N', 'TB status not assessed', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TB Investigation Results
      await tenantDataSource.query(`
        INSERT INTO hiv_tb_investigation_results (code, name, display_order) VALUES
        ('1', 'Investigated and has Active TB not started on TB treatment', 1),
        ('2', 'Investigated and had active Tuberculosis started TB treatment', 2),
        ('3', 'Investigated and has No Active TB', 3),
        ('4', 'Not Investigated', 4),
        ('5', 'Not Applicable', 5)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Opportunistic Infections
      await tenantDataSource.query(`
        INSERT INTO hiv_opportunistic_infections (code, name, category, has_sub_categories, display_order) VALUES
        ('Z', 'Zoster', 'OI', false, 1),
        ('P', 'Pneumonia', 'OI', false, 2),
        ('D', 'Dementia/Encephalitis', 'OI', false, 3),
        ('T', 'Thrush: oral/Vaginal', 'OI', false, 4),
        ('U', 'Ulcers: mouth, genital, etc.', 'OI', false, 5),
        ('I', 'IRIS', 'OI', false, 6),
        ('W', 'Weight Loss', 'OI', false, 7),
        ('To', 'Toxoplasmosis', 'OI', false, 8),
        ('STI', 'Sexual Transmitted Infection', 'OI', false, 9),
        ('H', 'Hypertension', 'Other', true, 10),
        ('Cx', 'Cancer', 'Other', false, 11),
        ('DM', 'Diabetes (Screened)', 'Other', true, 12),
        ('HBV', 'Hepatitis B', 'Other', true, 13),
        ('HCV', 'Hepatitis C', 'Other', true, 14),
        ('O', 'Other, specify', 'Other', false, 15)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed OI Sub-categories (after getting OI IDs)
      const hptOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'H'`);
      const dmOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'DM'`);
      const hbvOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'HBV'`);
      const hcvOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'HCV'`);

      if (hptOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hptOi[0].id}', 'HPT 2', 'Diagnosed', 1),
          ('${hptOi[0].id}', 'HPT 3', 'Managed', 2)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (dmOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${dmOi[0].id}', 'D1', 'Screened', 1),
          ('${dmOi[0].id}', 'T1D', 'Diabetes Type I', 2),
          ('${dmOi[0].id}', 'T2D', 'Diabetes Type II', 3),
          ('${dmOi[0].id}', 'D3', 'Managed for Diabetes', 4)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (hbvOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hbvOi[0].id}', 'HBV 1', 'Tested', 1),
          ('${hbvOi[0].id}', 'HBV 2', 'Positive', 2),
          ('${hbvOi[0].id}', 'HBV 3', 'on a TDF based regimen', 3)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (hcvOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hcvOi[0].id}', 'HCV 1', 'Tested', 1),
          ('${hcvOi[0].id}', 'HCV 2', 'Positive', 2),
          ('${hcvOi[0].id}', 'HCV 3', 'Treated', 3),
          ('${hcvOi[0].id}', 'HCV 4', 'Cured', 4)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      // Seed Mental Health Results
      await tenantDataSource.query(`
        INSERT INTO hiv_mental_health_results (code, name, display_order) VALUES
        ('N', 'Not screened', 1),
        ('ND', 'No Mental Health Disorders', 2),
        ('D', 'Depression', 3),
        ('A', 'Anxiety', 4),
        ('SA', 'Substance Misuse', 5),
        ('O', 'Other, Specify', 6)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Mental Health Management
      await tenantDataSource.query(`
        INSERT INTO hiv_mental_health_management (code, name, display_order) VALUES
        ('R', 'Referred', 1),
        ('Rx', 'Treated', 2),
        ('NT', 'Not treated', 3),
        ('N/A', 'Not Applicable', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TPT Eligibility
      await tenantDataSource.query(`
        INSERT INTO hiv_tpt_eligibility (code, name, is_eligible, display_order) VALUES
        ('Y', 'Eligible for TPT', true, 1),
        ('TB', 'Active TB disease', false, 2),
        ('ON', 'On TB treatment', false, 3),
        ('AL', 'Active Liver disease', false, 4),
        ('AA', 'Heavy Alcohol Abuse', false, 5),
        ('CPT', 'Completed IPT in the past = 3yrs', false, 6),
        ('DDI', 'Drug to Drug interactions', false, 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TPT Status
      await tenantDataSource.query(`
        INSERT INTO hiv_tpt_status (code, name, display_order) VALUES
        ('AT', 'Active TB disease', 1),
        ('II', 'INH Initiated', 2),
        ('3I', '3HP Initiated', 3),
        ('CT', 'Continue INH', 4),
        ('TC', 'INH Completed', 5),
        ('RI', 'Restart INH', 6),
        ('R3', 'Restart 3HP', 7),
        ('TNI', 'TPT Not Initiated due to available regimens', 8),
        ('PN', 'INH Stopped due to Peripheral Neuropathy', 9),
        ('PP', 'Patient Refused INH', 10)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Signs
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_signs (code, name, display_order) VALUES
        ('Y', 'Screened has no signs', 1),
        ('S', 'Presumptive Cryptococcal Signs', 2),
        ('N', 'Not assessed', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Status
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_status (code, name, display_order) VALUES
        ('1', 'Yes (Positive)', 1),
        ('2', 'Yes (Negative)', 2),
        ('3', 'N-Not Assessed', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Treatment
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_treatment (code, name, display_order) VALUES
        ('a', 'Liposomal Amphotericin B, Flucytosine + Fluconazole', 1),
        ('b', 'Liposomal Amphotericin B + Flucytosine', 2),
        ('c', 'Fluconazole + Flucytosine', 3),
        ('d', 'Others Specify', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Status
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_status (code, name, display_order) VALUES
        ('1', 'No ARV', 1),
        ('2a', 'Start ARV', 2),
        ('2b', 'Start ARV (Pregnant)', 3),
        ('3', 'Continue', 4),
        ('4', 'Change', 5),
        ('5', 'Stop', 6),
        ('6', 'Restart', 7),
        ('7', 'Transfer Out', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Initiation Category
      await tenantDataSource.query(`
        INSERT INTO hiv_art_initiation_category (code, name, display_order) VALUES
        ('N1', 'Newly Initiated ART', 1),
        ('N2.1', 'Re-initiation < 3 months after stopping ART', 2),
        ('N2.2', 'Re-initiation 3-5 months after stopping ART', 3),
        ('N2.3', 'Re-initiation 6+ months after stopping ART', 4),
        ('N3.1', 'Re-engagement <3 months after lost to follow up', 5),
        ('N3.2', 'Re-engagement 3-5 months after lost to follow up', 6),
        ('N3.3', 'Re-engagement 6+ months after lost to follow up', 7),
        ('N4', 'transfer in on ART from the private sector or diaspora', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Adverse Events Status
      await tenantDataSource.query(`
        INSERT INTO hiv_adverse_events_status (code, name, severity, display_order) VALUES
        ('a', 'INH1-minor adverse events reported on INH', 'minor', 1),
        ('b', 'INH2-stopping INH due to adverse events', 'stopping', 2),
        ('C1', '3HP1-minor adverse events reported on 3HP', 'minor', 3),
        ('C2', '3HP1-stopping 3HP1 due to adverse events', 'stopping', 4),
        ('c', 'CTX1-minor adverse event reported on CTX', 'minor', 5),
        ('d', 'CTX2-stopping CTX due to adverse events', 'stopping', 6),
        ('e', 'Diflucan1-minor adverse events reported on Diflucan', 'minor', 7),
        ('f', 'Diflucan 2-stopping Diflucan due to adverse events', 'stopping', 8),
        ('g', 'ART 1st Line1-minor adverse events reported on 1st Line ART', 'minor', 9),
        ('h', 'ART 1st Line 2-stopping 1st Line ART due to adverse events', 'stopping', 10),
        ('i', 'ART 2nd regimen1-minor adverse events reported on 2-line ART', 'minor', 11),
        ('J', 'ART 2nd regimen2-stopping 2nd-line ART due to adverse events', 'stopping', 12),
        ('k', 'ART 3rd regimen1-minor adverse events reported on Third line ART', 'minor', 13),
        ('l', 'ART 3rd regimen2 - stopping Third line ART due to adverse events', 'stopping', 14)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Reasons (Not on ARV)
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_reasons_not_on (code, name, display_order) VALUES
        ('11', 'No psychologically ready', 1),
        ('13', 'No ARVs available', 2),
        ('14', 'Not willing', 3),
        ('15', 'On Initial 2 weeks of TB Treatment', 4),
        ('16', 'Awaits Lab results', 5),
        ('17', 'Has OI and is too sick to start', 6),
        ('18', 'No start-other', 7),
        ('19', 'On initial 4 weeks of Cryptococcal Meningitis treatment', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Reasons (Start ARV)
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_reasons_start (code, name, display_order) VALUES
        ('215', 'Treat all', 1),
        ('216', 'Pregnant women', 2),
        ('217', 'Lactation women', 3),
        ('218', 'Other (Specify)', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Change/Stop Reasons
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_change_stop_reasons (code, name, display_order) VALUES
        ('401', 'Start TB Rx', 1),
        ('402', 'Nausea/Vomiting', 2),
        ('403', 'Diarrhoea', 3),
        ('404', 'Headache', 4),
        ('405', 'Fever', 5),
        ('406', 'Rash', 6),
        ('407', 'Peripheral Neuropathy', 7),
        ('408', 'Hepatitis', 8),
        ('409', 'Jaundice', 9),
        ('410', 'Dementia', 10),
        ('411', 'Anemia', 11),
        ('413', 'CNS Adverse event', 12),
        ('414', 'Other Adverse event (specify)', 13),
        ('415', 'Treatment Failure, clinical', 14),
        ('416', 'Treatment Failure, immunological', 15),
        ('417', 'Poor Adherence', 16),
        ('418', 'Patient Decision', 17),
        ('421', 'Stock out', 18),
        ('422', 'Other reason (specify)', 19),
        ('424', 'Virological Failure', 20),
        ('425', 'Weight gain>10%', 21),
        ('427', 'Treatment optimization', 22)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Visit Status
      await tenantDataSource.query(`
        INSERT INTO hiv_visit_status (code, name, display_order) VALUES
        ('E', 'Earlier than review date', 1),
        ('OT', 'On time', 2),
        ('L', 'Late but not defaulter', 3),
        ('D', 'Default<28days', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Final Outcome
      await tenantDataSource.query(`
        INSERT INTO hiv_final_outcome (code, name, display_order) VALUES
        ('Tx', 'active on treatment', 1),
        ('Miss', '1 or 2 missing Appointments', 2),
        ('LTFU', 'Lost to Follow-up', 3),
        ('TO', 'Transfer Out (specify)', 4),
        ('D', 'Patient Died', 5),
        ('OO', 'Patient Opted Out', 6),
        ('O', 'Other, specify', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Pre-Cancerous Lesion Treatment
      await tenantDataSource.query(`
        INSERT INTO hiv_precancerous_lesion_treatment (code, name, display_order) VALUES
        ('N', 'No treatment done', 1),
        ('VC', 'VIAC Pos, Cryotherapy Done', 2),
        ('VT', 'VIAC Pos, Thermal Ablation Done', 3),
        ('VL', 'VIAC Pos, LEEP Done', 4),
        ('SC', 'Suspected Cancer', 5),
        ('H', 'Hysterectomy', 6),
        ('R', 'Refer for Further clinical investigation if HPV Neg, but VIAC Pos', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed WHO Staging (Adults)
      const whoStagingAdults = [
        { stage: 1, conditions: ['Asymptomatic', 'Persistent Generalised Lymphadenopathy (PGL)'] },
        { stage: 2, conditions: ['Weight loss, <10% of body weight', 'Recurrent RTI (Respiratory Tract Infection)', 'Herpes Zoster', 'Angular Cheilitis', 'Recurrent ulcerations occurring twice or more then in six months', 'Papular pruritic eruptions', 'Seborrheic dermatitis', 'Fungal nail infections of the fingers'] },
        { stage: 3, conditions: ['Weight loss; >10% of body weight', 'Unexplained chronic diarrhoea >1 month', 'Unexplained prolonged fever >1 month', 'Pulmonary Tuberculosis, current or within the past 2 months or TB adenitis', 'Severe infection including pneumonia, meningitis, bone or joint infection', 'Oral Candidiasis', 'Oral hairy leukoplakia', 'Acute necrotising ulcerative gingivitis or necrotizing ulcerative periodontitis', 'Unexplained anaemia >1 month'] },
        { stage: 4, conditions: ['HIV wasting syndrome', 'Pneumocystis Pneumonia', 'Recurrent severe or radiological bacterial pneumonia (two or more episodes within a year)', 'Cryptococcal meningitis or other extra pulmonary', 'Cryptococcus infections', 'Extra Pulmonary Tuberculosis except TB adenitis', 'Kaposi Sarcoma', 'HIV Encephalopathy', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 'Chronic Herpes simplex virus (HSV) infection (orolabial, genital or anorectal >1 month, or visceral any duration)', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes', 'Progressive Multifocal Leukoencephalopathy (PML)', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 'Lymphoma (cerebral or B cell non-Hodgkin)', 'Recurrent non typhoidal salmonella septicaemia (2 or more episodes in last year)', 'Invasive cervical cancer', 'Visceral leishmaniosis', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 'Psoriasis', 'Disseminated non-tuberculous mycobacterial infection', 'CNS toxoplasmosis'] }
      ];

      for (const stageData of whoStagingAdults) {
        let order = 1;
        for (const condition of stageData.conditions) {
          const conditionCode = `ADULT_ST${stageData.stage}_${order}`.replace(/\s+/g, '_').toUpperCase().substring(0, 50);
          await tenantDataSource.query(`
            INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (condition_code) DO NOTHING
          `, [stageData.stage, 'Adults', conditionCode, condition, order]);
          order++;
        }
      }

      // Seed WHO Staging (Paediatrics)
      const whoStagingPaed = [
        { stage: 1, conditions: ['Asymptomatic', 'PGL'] },
        { stage: 2, conditions: ['Hepatosplenomegaly', 'Papular pruritic eruptions', 'Seborrheic dermatitis', 'Fungal nail infections of the fingers', 'Angular Cheilitis', 'Lineal Gingival erythema (LGE)', 'Human Papilloma Virus infection (extensive facial >5% of body area or disfiguring)', 'Molluscum contagiosum infection (extensive facial >5% of body area or disfiguring)', 'Recurrent ulcerations occurring twice or more then in six months', 'Parotid enlargement', 'Herpes Zoster', 'Recurrent Respiratory Tract Infections (RTI) (twice or more in any six month period)'] },
        { stage: 3, conditions: ['Unexplained malnutrition (very low weight for age; up to 2 standard deviations)', 'Unexplained persistent diarrhoea (> 14 days and above)', 'Unexplained persistent fever (intermittent or constant and for longer than 1 month)', 'Oral Candidiasis (outside first 6 weeks of life)', 'Oral hairy leukoplakia', 'Pulmonary Tuberculosis', 'Severe presumed bacterial pneumonia', 'Acute necrotising ulcerative gingivitis, or stomatitis or acute necrotizing ulcerative periodontitis', 'Symptomatic Lymphocytic Interstitial Pneumonia', 'Chronic HIV associated disease (including bronchiectasis)', 'Unexplained anaemia or neutropenia >1 monthly'] },
        { stage: 4, conditions: ['Unexplained severe wasting or severe malnutrition not adequately responding to standard therapy', 'Pneumocystis Jirovecci Pneumonia (PJP)', 'Recurrent severe presumed bacterial infection (e.g. meningitis, empyema, pyomyocitis bone or joint infection, bacteraemia)', 'Chronic Herpes simplex virus infection (chronic orolabial or intraoral lesions, of more than 1 month or visceral of any duration)', 'Extra pulmonary Tuberculosis', 'Kaposi Sarcoma', 'HIV Encephalopathy', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes with onset of age >1 month', 'Cryptococcal Meningitis', 'PML', 'Disseminated mycobacteriosis other than TB', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 'Lymphoma (cerebral or B cell non-Hodgkin)', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 'Psoriasis', 'CNS toxoplasmosis (outside the neonatal period)', 'Acquired HIV-associated rectal fistula, including rectovaginal fistula', 'HIV associated nephropathy', 'HIV associated cardiomyopathy'] }
      ];

      for (const stageData of whoStagingPaed) {
        let order = 1;
        for (const condition of stageData.conditions) {
          const conditionCode = `PAED_ST${stageData.stage}_${order}`.replace(/\s+/g, '_').toUpperCase().substring(0, 50);
          await tenantDataSource.query(`
            INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (condition_code) DO NOTHING
          `, [stageData.stage, 'Paediatrics', conditionCode, condition, order]);
          order++;
        }
      }

      // Seed ART Regimens - Adult 1st Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('1c', 'AZT+3TC+NVP', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'NVP'], false, 1),
        ('1d', 'AZT+3TC+EFV', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV'], false, 2),
        ('1e', 'TDF+3TC+NVP', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'NVP'], false, 3),
        ('1f', 'TDF+3TC+EFV', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV'], false, 4),
        ('1g', 'AZT+3TC+EFV400', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV400'], false, 5),
        ('1h', 'TDF+3TC+EFV400', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV400'], false, 6),
        ('1i', 'TDF+3TC+DTG(TLD1)', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 7),
        ('1j', 'AZT+3TC+DTG', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 8),
        ('1k', 'TDF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'EFV400'], false, 9),
        ('1l', 'TAF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'EFV400'], false, 10),
        ('1m', 'TDF+FTC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'ATC/r'], false, 11),
        ('1n', 'TDF+3TC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATC/r'], false, 12),
        ('1o', 'TDF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 13),
        ('1p', 'TAF+FTC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'ATV/r'], false, 14),
        ('1q', 'TAF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', '3TC', 'ATV/r'], false, 15),
        ('1r', 'ABC+3TC+DTG', '1st Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 16),
        ('1s', 'Other, Specify', '1st Line', 'Adult', ARRAY['Other'], false, 17)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Adult 2nd Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('2a', 'AZT+3TC+ILPV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'LPV/r'], false, 1),
        ('2b', 'TDF+3TC+LPV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'LPV/r'], false, 2),
        ('2c', 'ABC+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'LPV/r'], false, 3),
        ('2d', 'AZT+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'ATV/r'], false, 4),
        ('2e', 'TDF+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 5),
        ('2f', 'ABC+DDI250+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'ATV/r'], false, 6),
        ('2g', 'ABC+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'LPV/r'], false, 7),
        ('2h', 'AZT+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI250', 'LPV/r'], false, 8),
        ('2i', 'AZT+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI400', 'LPV/r'], false, 9),
        ('2j', 'ABC+DDI400+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'ATV/r'], false, 10),
        ('2k', 'ABC+3TC+DTG', '2nd Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 11),
        ('2l', 'AZT+3TC+DTG', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 12),
        ('2m', 'TDF+3TC+DTG(TLD2)', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 13),
        ('2n', 'TAF+3TC+DTG', '2nd Line', 'Adult', ARRAY['TAF', '3TC', 'DTG'], false, 14),
        ('2o', 'Other, Specify', '2nd Line', 'Adult', ARRAY['Other'], false, 15)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Adult 3rd Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('3a', 'RAL/DRV/RTV', '3rd Line', 'Adult', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
        ('3b', 'Other, Specify', '3rd Line', 'Adult', ARRAY['Other'], false, 2)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 1st/2nd Line (Codes 4c-4k)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('4c', 'AZT+3TC+NVP', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 1),
        ('4d', 'AZT+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'EFV'], false, 2),
        ('4e', 'AZT+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 3),
        ('4f', 'ABC+DDI+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
        ('4g', 'ABC+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 5),
        ('4h', 'ABC+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'EFV'], false, 6),
        ('4i', 'AZT+3TC+RAL', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'RAL'], false, 7),
        ('4j', 'ABC+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 8),
        ('4k', 'TDF+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 9)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 2nd Line (Codes 5a-5m)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('5a', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 1),
        ('5b', 'ABC+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 2),
        ('5c', 'AZT+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 3),
        ('5e', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
        ('5f', 'ABC+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'NVP'], false, 5),
        ('5g', 'ABC+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 6),
        ('5h', 'TDF+3TC+ATV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'ATV/r'], false, 7),
        ('5i', 'TDF+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 8),
        ('5j', 'AZT+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'DTG'], false, 9),
        ('5k', 'TDF+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'LPV/r'], false, 10),
        ('5l', 'AZT+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 11),
        ('5m', 'Other, Specify', 'Children 2nd Line', 'Paediatric', ARRAY['Other'], false, 12)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 3rd Line (Codes 6a-6c)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('6a', 'RAL/DRV/RTV', 'Children 3rd Line', 'Paediatric', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
        ('6b', 'DTG+DRV+2NRTIs', 'Children 3rd Line', 'Paediatric', ARRAY['DTG', 'DRV', '2NRTIs'], false, 2),
        ('6c', 'Other, Specify', 'Children 3rd Line', 'Paediatric', ARRAY['Other'], false, 3)
        ON CONFLICT (code) DO NOTHING
      `);

      this.logger.log('HIV lookup tables seeded successfully');
    } catch (error) {
      this.logger.error('Error seeding lookup tables:', error);
      // Don't throw - allow schema to be created even if seeding fails
    }
  }

  private async seedDefaultUsers(tenantDataSource: DataSource, tenantSlug: string): Promise<void> {
    // Sanitize slug to alphanumeric + hyphen only before interpolating into SQL
    const s = tenantSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!s) return;

    this.logger.log(`Seeding default demo users for tenant: ${s}`);

    // Medicore1# — meets policy (uppercase, lowercase, digit, special char, 9 chars)
    const demoPasswordHash = '$2b$10$WN4.1EiRgPP.oBR2hKOurulJvnlC6muYcBOtesTwgekWhqmacgUDy';
    await tenantDataSource.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, license_number, specialization, phone, must_change_password)
      VALUES
        ('doctor@${s}.com',       '${demoPasswordHash}', 'Demo',    'Doctor',       'doctor',       'MD-DEMO',   'Internal Medicine',     '+1 555 0001', false),
        ('nurse@${s}.com',        '${demoPasswordHash}', 'Demo',    'Nurse',        'nurse',        'RN-DEMO',   'General Nursing',        '+1 555 0002', false),
        ('nurse.accounts@${s}.com','${demoPasswordHash}', 'Demo',   'NurseAccounts','nurse_accounts','RN-ACC',   'Finance & Nursing',      '+1 555 0003', false),
        ('pharmacist@${s}.com',   '${demoPasswordHash}', 'Demo',    'Pharmacist',   'pharmacist',   'PH-DEMO',   'Clinical Pharmacy',      '+1 555 0004', false),
        ('lab@${s}.com',          '${demoPasswordHash}', 'Demo',    'LabTech',      'lab_tech',     'LT-DEMO',   'Clinical Laboratory',    '+1 555 0005', false),
        ('radiologist@${s}.com',  '${demoPasswordHash}', 'Demo',    'Radiologist',  'radiologist',  'RAD-DEMO',  'Diagnostic Radiology',   '+1 555 0006', false),
        ('accounts@${s}.com',     '${demoPasswordHash}', 'Demo',    'Accounts',     'accounts',     NULL,        'Revenue Management',     '+1 555 0007', false),
        ('receptionist@${s}.com', '${demoPasswordHash}', 'Demo',    'Receptionist', 'receptionist', NULL,        'Front Desk',             '+1 555 0008', false),
        ('admin@${s}.com',        '${demoPasswordHash}', 'Demo',    'Admin',        'admin',        NULL,        'System Administration',  '+1 555 0009', false)
      ON CONFLICT (email) DO NOTHING;
    `);

    this.logger.log(`Demo users seeded. Password for all: Medicore1# | Logins: doctor@${s}.com, nurse@${s}.com, ...`);
  }

  private async seedLabCatalog(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding baseline laboratory catalog...');

    await tenantDataSource.query(`
      INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
      VALUES
        ('CBC', '58410-2', 'Complete Blood Count (CBC)', 'Hematology', 'Whole Blood', '3-5 mL', 'EDTA (Purple Top)', 2, 15.00,
         'Comprehensive blood test measuring red and white cells with platelets',
         'Evaluates overall health, detects anemia, infection, and blood disorders', true),
        ('BMP', '51990-0', 'Basic Metabolic Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 3, 25.00,
         'Glucose, calcium, electrolytes, and kidney function tests',
         'Evaluates kidney function, electrolyte balance, and blood sugar levels', true),
        ('LIPID', '57698-3', 'Lipid Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 30.00,
         'Measures cholesterol and triglycerides to assess cardiovascular risk',
         'Screens for risk of heart disease and stroke', true),
        ('LFT', '24325-3', 'Liver Function Tests', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 35.00,
         'Measures liver enzymes and proteins to assess liver function',
         'Detects liver disease, damage, or dysfunction', true),
        ('HBA1C', '4548-4', 'Hemoglobin A1C', 'Chemistry', 'Whole Blood', '2 mL', 'EDTA (Purple Top)', 3, 20.00,
         'Measures average blood glucose control over the past 2-3 months',
         'Monitors long-term diabetes control', true),
        ('MALARIA', NULL, 'Malaria Rapid Test (RDT)', 'Microbiology', 'Whole Blood', '5 µL', 'Capillary or EDTA', 1, 5.00,
         'Rapid diagnostic test for Plasmodium species antigens',
         'Detects active malaria infection', true),
        ('HIV', NULL, 'HIV Rapid Antibody Test', 'Serology', 'Whole Blood or Serum', '50 µL', 'Capillary or Red Top', 1, 8.00,
         'Rapid antibody test for HIV-1 and HIV-2',
         'Screens for HIV infection', true),
        ('VDRL', '5292-8', 'VDRL (Syphilis Screen)', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 10.00,
         'Screening test for syphilis antibodies',
         'Detects active or past syphilis infection', true),
        ('HBSAG', '5196-1', 'Hepatitis B Surface Antigen', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 12.00,
         'Tests for active Hepatitis B infection',
         'Screens for Hepatitis B virus', true),
        ('UA', '24356-8', 'Urinalysis (Complete)', 'Urinalysis', 'Urine', '10-15 mL', 'Sterile Container', 2, 10.00,
         'Complete urinalysis including physical, chemical, and microscopic examination',
         'Screens for urinary tract infections, kidney disease, and metabolic disorders', true),
        ('HCG', '21198-7', 'Pregnancy Test (HCG)', 'Serology', 'Urine or Serum', '5 mL', 'Sterile Container or Red Top', 1, 8.00,
         'Qualitative test for human chorionic gonadotropin',
         'Confirms pregnancy', true)
      ON CONFLICT (test_code) DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, gender_specific, sort_order)
      SELECT id, 'Hemoglobin', 'HGB', '718-7', 'g/dL', 12.0, 17.5, 7.0, 20.0, true, 1 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
      SELECT id, 18, 120, 'male', 13.5, 17.5, 'g/dL' FROM lab_test_components WHERE component_code = 'HGB'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
      SELECT id, 18, 120, 'female', 12.0, 15.5, 'g/dL' FROM lab_test_components WHERE component_code = 'HGB'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'White Blood Cell Count', 'WBC', '6690-2', '10^9/L', 4.0, 11.0, 2.0, 30.0, 2 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Platelet Count', 'PLT', '777-3', '10^9/L', 150.0, 400.0, 50.0, 1000.0, 3 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Glucose', 'GLU', '2345-7', 'mg/dL', 70.0, 100.0, 40.0, 500.0, 1 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Sodium', 'NA', '2951-2', 'mmol/L', 135.0, 145.0, 120.0, 160.0, 2 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Potassium', 'K', '2823-3', 'mmol/L', 3.5, 5.0, 2.5, 6.5, 3 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
      VALUES
        ('Pre-Operative Panel', 'PREOP', 'Standard pre-operative tests', '[]'::jsonb, 'Surgery', true),
        ('Diabetes Monitoring', 'DM', 'Standard diabetes monitoring tests', '[]'::jsonb, 'Endocrinology', true),
        ('Antenatal Panel', 'ANC', 'Standard antenatal care tests', '[]'::jsonb, 'Obstetrics', true),
        ('Cardiac Risk Assessment', 'CARDIAC', 'Cardiovascular risk evaluation', '[]'::jsonb, 'Cardiology', true)
      ON CONFLICT (set_code) DO NOTHING;
    `);

    const labOrderSetLinks = [
      { set: 'PREOP', test: 'CBC', order: 1 },
      { set: 'PREOP', test: 'BMP', order: 2 },
      { set: 'PREOP', test: 'HCG', order: 3 },
      { set: 'DM', test: 'HBA1C', order: 1 },
      { set: 'DM', test: 'BMP', order: 2 },
      { set: 'DM', test: 'LIPID', order: 3 },
      { set: 'ANC', test: 'CBC', order: 1 },
      { set: 'ANC', test: 'HIV', order: 2 },
      { set: 'ANC', test: 'VDRL', order: 3 },
      { set: 'ANC', test: 'HBSAG', order: 4 },
      { set: 'ANC', test: 'UA', order: 5 },
      { set: 'CARDIAC', test: 'LIPID', order: 1 },
      { set: 'CARDIAC', test: 'HBA1C', order: 2 },
      { set: 'CARDIAC', test: 'BMP', order: 3 }
    ];

    for (const link of labOrderSetLinks) {
      await tenantDataSource.query(`
        INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
        SELECT os.id, tc.id, ${link.order}
        FROM lab_order_sets os, lab_test_catalog tc
        WHERE os.set_code = '${link.set}' AND tc.test_code = '${link.test}'
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  private async seedImagingCatalog(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding baseline imaging catalog...');

    await tenantDataSource.query(`
      INSERT INTO imaging_modalities (modality_code, modality_name, description, is_active)
      VALUES 
        ('XR', 'X-Ray (Radiography)', 'Conventional radiography using ionizing radiation', true),
        ('CT', 'CT Scan (Computed Tomography)', 'Cross-sectional imaging using X-rays and computer processing', true),
        ('MRI', 'MRI (Magnetic Resonance Imaging)', 'Imaging using magnetic fields and radio waves', true),
        ('US', 'Ultrasound', 'Imaging using high-frequency sound waves', true),
        ('MG', 'Mammography', 'Breast imaging using low-dose X-rays', true),
        ('FL', 'Fluoroscopy', 'Real-time X-ray imaging', true),
        ('NM', 'Nuclear Medicine', 'Imaging using radioactive tracers', true),
        ('PET', 'PET Scan', 'Positron emission tomography for metabolic imaging', true)
      ON CONFLICT (modality_code) DO NOTHING;
    `);

    const imagingStudies = [
      { modality: 'XR', code: 'CXR-PA', name: 'Chest X-Ray (PA)', body: 'Chest', views: '{PA}', images: 1, contrast: false, cost: 25.00, prep: 'Remove jewelry and metal. Hold breath when instructed.' },
      { modality: 'XR', code: 'CXR-PA-LAT', name: 'Chest X-Ray (PA & Lateral)', body: 'Chest', views: '{PA,Lateral}', images: 2, contrast: false, cost: 35.00, prep: 'Remove jewelry and metal. Hold breath when instructed.' },
      { modality: 'XR', code: 'SPINE-L', name: 'Lumbar Spine X-Ray', body: 'Lumbar Spine', views: '{AP,Lateral}', images: 2, contrast: false, cost: 45.00, prep: 'Remove metal objects. Stand still during imaging.' },
      { modality: 'CT', code: 'CT-HEAD', name: 'CT Head (Brain)', body: 'Head/Brain', views: null, images: 1, contrast: false, cost: 200.00, prep: 'Remove metal from head. Remain still during scan.' },
      { modality: 'CT', code: 'CT-ABD-PELVIS', name: 'CT Abdomen & Pelvis', body: 'Abdomen/Pelvis', views: null, images: 1, contrast: true, cost: 300.00, prep: 'NPO 4 hours before scan. Oral contrast may be required.' },
      { modality: 'MRI', code: 'MRI-BRAIN', name: 'MRI Brain', body: 'Brain', views: null, images: 1, contrast: false, cost: 400.00, prep: 'Screen for implants. Remove all metal.' },
      { modality: 'MRI', code: 'MRI-SPINE-L', name: 'MRI Lumbar Spine', body: 'Lumbar Spine', views: null, images: 1, contrast: false, cost: 450.00, prep: 'Screen for implants. Remove all metal.' },
      { modality: 'US', code: 'US-ABD', name: 'Abdomen Ultrasound', body: 'Abdomen', views: null, images: 1, contrast: false, cost: 75.00, prep: 'NPO 6-8 hours before exam.' },
      { modality: 'US', code: 'US-OB', name: 'Obstetric Ultrasound', body: 'Uterus/Fetus', views: null, images: 1, contrast: false, cost: 85.00, prep: 'Full bladder recommended for early pregnancy.' },
      { modality: 'US', code: 'US-THYROID', name: 'Thyroid Ultrasound', body: 'Neck/Thyroid', views: null, images: 1, contrast: false, cost: 70.00, prep: 'No special preparation required.' },
      { modality: 'MG', code: 'MG-SCREENING', name: 'Screening Mammogram', body: 'Breast', views: '{CC,MLO}', images: 4, contrast: false, cost: 120.00, prep: 'Avoid deodorant/powder on exam day. Wear two-piece clothing.' }
    ];

    for (const study of imagingStudies) {
      await tenantDataSource.query(`
        INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
        SELECT mod.id, '${study.code}', '${study.name.replace(/'/g, "''")}', '${study.body}', ${study.views ? `'${study.views}'::text[]` : 'NULL'}, ${study.images}, ${study.contrast}, ${study.cost.toFixed(2)},
               '${study.name.replace(/'/g, "''")}', ${study.prep ? `'${study.prep.replace(/'/g, "''")}'` : 'NULL'}, true
        FROM imaging_modalities mod
        WHERE mod.modality_code = '${study.modality}'
        ON CONFLICT (study_code) DO NOTHING;
      `);
    }

    await tenantDataSource.query(`
      INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
      SELECT mod.id, st.id,
             'Chest X-Ray - Normal', 'CXR-NORMAL',
             'PA and lateral chest radiographs were obtained.',
             E'LUNGS: Clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.\nHEART: Normal size and contour.\nMEDIASTINUM: Normal width. No mediastinal mass.\nBONES: No acute fracture.\nSOFT TISSUES: Unremarkable.',
             'Normal chest radiograph.',
             true
      FROM imaging_modalities mod
      JOIN imaging_study_types st ON st.study_code = 'CXR-PA-LAT'
      WHERE mod.modality_code = 'XR'
      ON CONFLICT (template_code) DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
      SELECT mod.id, st.id,
             'Abdomen Ultrasound - Normal', 'US-ABD-NORMAL',
             'Grayscale ultrasound examination of the abdomen.',
             E'LIVER: Normal size, echogenicity, and contour. No focal lesion.\nGALLBLADDER: Normal. No stones or wall thickening.\nKIDNEYS: Normal size and echogenicity. No hydronephrosis or stones.\nSPLEEN: Normal.\nASCITES: None.',
             'Normal abdominal ultrasound.',
             true
      FROM imaging_modalities mod
      JOIN imaging_study_types st ON st.study_code = 'US-ABD'
      WHERE mod.modality_code = 'US'
      ON CONFLICT (template_code) DO NOTHING;
    `);
  }

  private async seedClinicalNoteTemplates(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding default clinical note templates...');

    const templates = [
      {
        name: 'General SOAP Note',
        category: 'SOAP',
        content: `CHIEF COMPLAINT:
{{chiefComplaint}}

SUBJECTIVE:
{{subjective}}

OBJECTIVE:
Vital Signs: {{vitalSigns}}
Physical Examination: {{physicalExam}}

ASSESSMENT:
{{assessment}}

PLAN:
{{plan}}`,
        variables: ['chiefComplaint', 'subjective', 'vitalSigns', 'physicalExam', 'assessment', 'plan'],
        isDefault: true,
      },
      {
        name: 'History & Physical (H&P)',
        category: 'H&P',
        content: `HISTORY & PHYSICAL EXAMINATION

CHIEF COMPLAINT:
{{chiefComplaint}}

HISTORY OF PRESENT ILLNESS:
{{historyPresentIllness}}

PAST MEDICAL HISTORY:
{{pastMedicalHistory}}

MEDICATIONS:
{{medications}}

ALLERGIES:
{{allergies}}

SOCIAL HISTORY:
{{socialHistory}}

FAMILY HISTORY:
{{familyHistory}}

REVIEW OF SYSTEMS:
{{reviewOfSystems}}

PHYSICAL EXAMINATION:
{{physicalExamination}}

ASSESSMENT AND PLAN:
{{assessmentPlan}}`,
        variables: ['chiefComplaint', 'historyPresentIllness', 'pastMedicalHistory', 'medications', 'allergies', 'socialHistory', 'familyHistory', 'reviewOfSystems', 'physicalExamination', 'assessmentPlan'],
        isDefault: true,
      },
      {
        name: 'Progress Note',
        category: 'Progress',
        content: `PROGRESS NOTE

Date: {{date}}
Provider: {{providerName}}

SUBJECTIVE:
{{subjective}}

OBJECTIVE:
{{objective}}

ASSESSMENT:
{{assessment}}

PLAN:
{{plan}}

Follow-up: {{followUp}}`,
        variables: ['date', 'providerName', 'subjective', 'objective', 'assessment', 'plan', 'followUp'],
        isDefault: true,
      },
      {
        name: 'Discharge Summary',
        category: 'Discharge',
        content: `DISCHARGE SUMMARY

Patient: {{patientName}}
Date of Admission: {{admissionDate}}
Date of Discharge: {{dischargeDate}}
Attending Physician: {{providerName}}

ADMISSION DIAGNOSIS:
{{admissionDiagnosis}}

DISCHARGE DIAGNOSIS:
{{dischargeDiagnosis}}

HOSPITAL COURSE:
{{hospitalCourse}}

DISCHARGE MEDICATIONS:
{{dischargeMedications}}

DISCHARGE INSTRUCTIONS:
{{dischargeInstructions}}

FOLLOW-UP:
{{followUp}}`,
        variables: ['patientName', 'admissionDate', 'dischargeDate', 'providerName', 'admissionDiagnosis', 'dischargeDiagnosis', 'hospitalCourse', 'dischargeMedications', 'dischargeInstructions', 'followUp'],
        isDefault: true,
      },
      {
        name: 'Procedure Note',
        category: 'Procedure',
        content: `PROCEDURE NOTE

Procedure: {{procedureName}}
Date: {{date}}
Provider: {{providerName}}
Patient: {{patientName}}

INDICATION:
{{indication}}

PROCEDURE:
{{procedureDescription}}

COMPLICATIONS:
{{complications}}

POST-PROCEDURE PLAN:
{{postProcedurePlan}}`,
        variables: ['procedureName', 'date', 'providerName', 'patientName', 'indication', 'procedureDescription', 'complications', 'postProcedurePlan'],
        isDefault: true,
      },
      {
        name: 'Consultation Note',
        category: 'Consultation',
        content: `CONSULTATION NOTE

Date: {{date}}
Consultant: {{providerName}}
Referring Physician: {{referringPhysician}}
Patient: {{patientName}}

REASON FOR CONSULTATION:
{{reasonForConsultation}}

HISTORY:
{{history}}

EXAMINATION:
{{examination}}

ASSESSMENT:
{{assessment}}

RECOMMENDATIONS:
{{recommendations}}`,
        variables: ['date', 'providerName', 'referringPhysician', 'patientName', 'reasonForConsultation', 'history', 'examination', 'assessment', 'recommendations'],
        isDefault: true,
      },
    ];

    for (const template of templates) {
      // Check if template already exists
      const existing = await tenantDataSource.query(`
        SELECT id FROM clinical_note_templates WHERE name = $1 AND category = $2
      `, [template.name, template.category]);

      if (existing.length === 0) {
        await tenantDataSource.query(`
          INSERT INTO clinical_note_templates (name, category, content, variables, is_default, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, true, NOW(), NOW())
        `, [
          template.name,
          template.category,
          template.content,
          JSON.stringify(template.variables),
          template.isDefault,
        ]);
      }
    }

    this.logger.log(`Seeded ${templates.length} default clinical note templates`);
  }

  private async seedPrescriptionTemplates(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding default prescription templates...');

    const templates = [
      {
        name: 'Paracetamol 500mg',
        category: 'pain_management',
        medicationName: 'Paracetamol',
        genericName: 'Acetaminophen',
        dosage: '500',
        dosageUnit: 'mg',
        frequency: 'Every 6-8 hours as needed',
        route: 'oral',
        duration: '3-5 days',
        instructions: 'Take with or without food. Do not exceed 4g per day.',
        indications: 'Pain relief, fever reduction',
        contraindications: 'Severe liver disease',
        sideEffects: 'Rare: skin rash, liver damage with overdose',
        isDefault: true,
      },
      {
        name: 'Amoxicillin 500mg',
        category: 'antibiotic',
        medicationName: 'Amoxicillin',
        genericName: 'Amoxicillin',
        dosage: '500',
        dosageUnit: 'mg',
        frequency: 'Three times daily',
        route: 'oral',
        duration: '7-10 days',
        instructions: 'Take with food to reduce stomach upset. Complete full course even if feeling better.',
        indications: 'Bacterial infections (respiratory, urinary, skin)',
        contraindications: 'Penicillin allergy',
        sideEffects: 'Diarrhea, nausea, rash',
        isDefault: true,
      },
      {
        name: 'Ibuprofen 400mg',
        category: 'pain_management',
        medicationName: 'Ibuprofen',
        genericName: 'Ibuprofen',
        dosage: '400',
        dosageUnit: 'mg',
        frequency: 'Every 6-8 hours with food',
        route: 'oral',
        duration: '3-7 days',
        instructions: 'Take with food or milk. Avoid if history of stomach ulcers.',
        indications: 'Pain, inflammation, fever',
        contraindications: 'Active peptic ulcer, severe heart failure, third trimester pregnancy',
        sideEffects: 'Stomach upset, dizziness, headache',
        isDefault: true,
      },
      {
        name: 'Metformin 500mg',
        category: 'diabetes',
        medicationName: 'Metformin',
        genericName: 'Metformin',
        dosage: '500',
        dosageUnit: 'mg',
        frequency: 'Twice daily with meals',
        route: 'oral',
        duration: 'Ongoing',
        instructions: 'Take with meals to reduce gastrointestinal side effects. Start with once daily for first week.',
        indications: 'Type 2 diabetes mellitus',
        contraindications: 'Severe renal impairment, metabolic acidosis',
        sideEffects: 'Nausea, diarrhea, metallic taste',
        isDefault: true,
      },
      {
        name: 'Amlodipine 5mg',
        category: 'hypertension',
        medicationName: 'Amlodipine',
        genericName: 'Amlodipine',
        dosage: '5',
        dosageUnit: 'mg',
        frequency: 'Once daily',
        route: 'oral',
        duration: 'Ongoing',
        instructions: 'Take at the same time each day. May cause ankle swelling.',
        indications: 'Hypertension, angina',
        contraindications: 'Severe hypotension, cardiogenic shock',
        sideEffects: 'Dizziness, ankle swelling, flushing',
        isDefault: true,
      },
      {
        name: 'Salbutamol Inhaler',
        category: 'respiratory',
        medicationName: 'Salbutamol',
        genericName: 'Albuterol',
        dosage: '100',
        dosageUnit: 'mcg',
        frequency: '1-2 puffs as needed, up to 4 times daily',
        route: 'inhalation',
        duration: 'As needed',
        instructions: 'Shake well before use. Rinse mouth after use to prevent thrush.',
        indications: 'Asthma, COPD, bronchospasm',
        contraindications: 'Hypersensitivity to salbutamol',
        sideEffects: 'Tremor, palpitations, headache',
        isDefault: true,
      },
    ];

    for (const template of templates) {
      const existing = await tenantDataSource.query(`
        SELECT id FROM prescription_templates WHERE name = $1 AND category = $2
      `, [template.name, template.category]);

      if (existing.length === 0) {
        await tenantDataSource.query(`
          INSERT INTO prescription_templates (name, category, medication_name, generic_name, dosage, dosage_unit, frequency, route, duration, instructions, indications, contraindications, side_effects, is_default, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), NOW())
        `, [
          template.name,
          template.category,
          template.medicationName,
          template.genericName,
          template.dosage,
          template.dosageUnit,
          template.frequency,
          template.route,
          template.duration,
          template.instructions,
          template.indications,
          template.contraindications,
          template.sideEffects,
          template.isDefault,
        ]);
      }
    }

    this.logger.log(`Seeded ${templates.length} default prescription templates`);
  }

  async deleteDatabase(databaseName: string): Promise<void> {
    try {
      this.assertSafeDatabaseName(databaseName);
      // Terminate connections to the database
      await this.dataSource.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [databaseName],
      );
      
      // Drop database
      await this.dataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      
      this.logger.log(`Database ${databaseName} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete database ${databaseName}:`, error);
      throw error;
    }
  }

  private getProSchemaStatements(): string[] {
    const statements: string[] = [];

    // Questionnaire Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS questionnaire_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        version VARCHAR(20) DEFAULT '1.0',
        is_active BOOLEAN DEFAULT true,
        is_standard BOOLEAN DEFAULT true,
        scoring_algorithm VARCHAR(100),
        min_score DECIMAL(10,2),
        max_score DECIMAL(10,2),
        questions JSONB NOT NULL,
        scoring_rules JSONB,
        alert_rules JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Patient Questionnaires Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_questionnaires (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
        appointment_id UUID REFERENCES appointments(id),
        assigned_by UUID REFERENCES users(id),
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        due_date TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),
        completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
        total_score DECIMAL(10,2),
        reminder_sent_count INTEGER DEFAULT 0,
        last_reminder_sent TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Questionnaire Responses Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS questionnaire_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_questionnaire_id UUID NOT NULL REFERENCES patient_questionnaires(id) ON DELETE CASCADE,
        question_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        response_value TEXT,
        response_type VARCHAR(50),
        response_options JSONB,
        score DECIMAL(10,2),
        answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Questionnaire Schedules Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS questionnaire_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
        schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('one_time', 'daily', 'weekly', 'monthly', 'event_triggered')),
        start_date DATE NOT NULL,
        end_date DATE,
        frequency INTEGER DEFAULT 1,
        day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
        day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
        trigger_event VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // PRO Alert Rules Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS pro_alert_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
        rule_name VARCHAR(255) NOT NULL,
        condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('score_greater_than', 'score_less_than', 'score_between', 'score_equals', 'change_greater_than')),
        condition_value JSONB NOT NULL,
        alert_severity VARCHAR(50) DEFAULT 'medium' CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
        alert_message TEXT,
        notify_roles TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // PRO Alerts Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS pro_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        patient_questionnaire_id UUID NOT NULL REFERENCES patient_questionnaires(id),
        alert_rule_id UUID REFERENCES pro_alert_rules(id),
        alert_severity VARCHAR(50) NOT NULL,
        alert_message TEXT NOT NULL,
        score_value DECIMAL(10,2),
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_patient_id ON patient_questionnaires(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_status ON patient_questionnaires(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_due_date ON patient_questionnaires(due_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_appointment_id ON patient_questionnaires(appointment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_patient_questionnaire_id ON questionnaire_responses(patient_questionnaire_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_patient_id ON questionnaire_schedules(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_active ON questionnaire_schedules(is_active) WHERE is_active = true`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pro_alerts_patient_id ON pro_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pro_alerts_status ON pro_alerts(status) WHERE status = 'active'`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_code ON questionnaire_templates(code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_active ON questionnaire_templates(is_active) WHERE is_active = true`);

    return statements;
  }

  private getHealthGoalsSchemaStatements(): string[] {
    const statements: string[] = [];

    // Patient Health Goals Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_health_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        goal_type VARCHAR(100) NOT NULL CHECK (goal_type IN ('weight_loss', 'weight_gain', 'blood_pressure', 'blood_glucose', 'cholesterol', 'exercise', 'medication_adherence', 'smoking_cessation', 'alcohol_reduction', 'diet', 'other')),
        goal_name VARCHAR(255) NOT NULL,
        description TEXT,
        target_value DECIMAL(10,2),
        current_value DECIMAL(10,2),
        unit VARCHAR(50),
        start_date DATE NOT NULL,
        target_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'failed')),
        progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
        milestone_percentage DECIMAL(5,2) DEFAULT 25,
        milestone_achieved BOOLEAN DEFAULT false,
        milestone_achieved_at TIMESTAMP WITH TIME ZONE,
        is_auto_tracked BOOLEAN DEFAULT false,
        tracking_source VARCHAR(100),
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Goal Progress Logs Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS goal_progress_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID NOT NULL REFERENCES patient_health_goals(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        logged_value DECIMAL(10,2) NOT NULL,
        logged_date DATE NOT NULL,
        source VARCHAR(100) CHECK (source IN ('manual', 'vitals', 'lab_result', 'patient_portal', 'wearable', 'auto')),
        source_id UUID,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(goal_id, logged_date)
      )
    `);

    // Patient Achievements Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        achievement_type VARCHAR(100) NOT NULL CHECK (achievement_type IN ('goal_completed', 'milestone_reached', 'streak', 'consistency', 'improvement', 'engagement', 'special')),
        achievement_name VARCHAR(255) NOT NULL,
        achievement_description TEXT,
        badge_icon VARCHAR(100),
        badge_color VARCHAR(50),
        points INTEGER DEFAULT 0,
        goal_id UUID REFERENCES patient_health_goals(id) ON DELETE SET NULL,
        milestone_percentage DECIMAL(5,2),
        streak_days INTEGER,
        earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Patient Streaks Table (for tracking consecutive days of activity)
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_streaks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        streak_type VARCHAR(100) NOT NULL CHECK (streak_type IN ('vitals_submission', 'medication_adherence', 'exercise', 'goal_progress', 'portal_login')),
        current_streak_days INTEGER DEFAULT 0,
        longest_streak_days INTEGER DEFAULT 0,
        last_activity_date DATE,
        streak_start_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(patient_id, streak_type)
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_health_goals_patient_id ON patient_health_goals(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_health_goals_status ON patient_health_goals(status) WHERE status = 'active'`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_health_goals_goal_type ON patient_health_goals(goal_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_health_goals_target_date ON patient_health_goals(target_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_goal_id ON goal_progress_logs(goal_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_patient_id ON goal_progress_logs(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_logged_date ON goal_progress_logs(logged_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_achievements_patient_id ON patient_achievements(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_achievements_achievement_type ON patient_achievements(achievement_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_achievements_earned_at ON patient_achievements(earned_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_streaks_patient_id ON patient_streaks(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_streaks_streak_type ON patient_streaks(streak_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_streaks_is_active ON patient_streaks(is_active) WHERE is_active = true`);

    return statements;
  }

  private getSprint14_2ClaimsEnhancementStatements(): string[] {
    const statements: string[] = [];

    // Enhance medical_aid_claims table with additional columns
    statements.push(`
      DO $$ 
      BEGIN
        -- Add pre_authorization_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'pre_authorization_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN pre_authorization_id UUID;
        END IF;

        -- Add resubmission_count if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'resubmission_count') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN resubmission_count INTEGER DEFAULT 0;
        END IF;

        -- Add original_claim_id for tracking resubmissions
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'original_claim_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN original_claim_id UUID REFERENCES medical_aid_claims(id) ON DELETE SET NULL;
        END IF;

        -- Add submission_method
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_method') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN submission_method VARCHAR(50) CHECK (submission_method IN ('api', 'edi', 'manual', 'bulk'));
        END IF;

        -- Add external_claim_id (from medical aid system)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'external_claim_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN external_claim_id VARCHAR(255);
        END IF;

        -- Add api_response_data for storing API responses
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'api_response_data') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN api_response_data JSONB;
        END IF;

        -- Add last_status_check_at
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'last_status_check_at') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN last_status_check_at TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Add next_status_check_at for polling
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'next_status_check_at') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN next_status_check_at TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Add diagnosis_codes if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'diagnosis_codes') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN diagnosis_codes TEXT[];
        END IF;

        -- Add primary_diagnosis_code
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'primary_diagnosis_code') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN primary_diagnosis_code VARCHAR(50);
        END IF;

        -- Add primary_diagnosis_description
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'primary_diagnosis_description') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN primary_diagnosis_description TEXT;
        END IF;

        -- Update status enum to include more states
        -- Note: This is handled by the CHECK constraint, but we ensure it's correct
      END $$;
    `);

    // Pre-Authorization Requests Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS pre_authorization_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        billing_id UUID REFERENCES billing(id) ON DELETE SET NULL,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        medical_aid_name VARCHAR(100) NOT NULL,
        member_number VARCHAR(100) NOT NULL,
        request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('consultation', 'procedure', 'surgery', 'hospitalization', 'medication', 'imaging', 'lab_test', 'other')),
        requested_amount DECIMAL(10,2) NOT NULL,
        approved_amount DECIMAL(10,2),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled')),
        request_date DATE NOT NULL,
        approval_date DATE,
        expiry_date DATE,
        rejection_reason TEXT,
        diagnosis_codes TEXT[],
        primary_diagnosis_code VARCHAR(50),
        primary_diagnosis_description TEXT,
        procedure_codes TEXT[],
        service_codes TEXT[],
        clinical_notes TEXT,
        request_data JSONB,
        api_response_data JSONB,
        external_preauth_id VARCHAR(255),
        submitted_at TIMESTAMP WITH TIME ZONE,
        responded_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Claim Status History Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS claim_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES medical_aid_claims(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        previous_status VARCHAR(50),
        changed_by UUID REFERENCES users(id),
        change_reason TEXT,
        notes TEXT,
        api_response JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Medical Aid API Configurations Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS medical_aid_api_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medical_aid_name VARCHAR(100) NOT NULL UNIQUE,
        provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('cimas', 'premier', 'econet_health', 'psmas', 'other')),
        api_base_url VARCHAR(500) NOT NULL,
        api_key VARCHAR(255),
        api_secret VARCHAR(255),
        authentication_type VARCHAR(50) NOT NULL CHECK (authentication_type IN ('api_key', 'oauth2', 'basic', 'bearer', 'custom')),
        auth_endpoint VARCHAR(500),
        token_endpoint VARCHAR(500),
        refresh_token_endpoint VARCHAR(500),
        claim_submission_endpoint VARCHAR(500),
        status_check_endpoint VARCHAR(500),
        preauth_endpoint VARCHAR(500),
        member_verification_endpoint VARCHAR(500),
        webhook_url VARCHAR(500),
        webhook_secret VARCHAR(255),
        request_timeout INTEGER DEFAULT 30000,
        retry_count INTEGER DEFAULT 3,
        retry_delay INTEGER DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        configuration_data JSONB,
        test_mode BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Claim Submissions Audit Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS claim_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES medical_aid_claims(id) ON DELETE CASCADE,
        submission_method VARCHAR(50) NOT NULL CHECK (submission_method IN ('api', 'edi', 'manual', 'bulk')),
        submission_status VARCHAR(50) NOT NULL CHECK (submission_status IN ('success', 'failed', 'pending', 'retrying')),
        submission_attempt INTEGER DEFAULT 1,
        request_payload JSONB,
        response_payload JSONB,
        error_message TEXT,
        error_code VARCHAR(100),
        external_reference_id VARCHAR(255),
        submitted_by UUID REFERENCES users(id),
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        responded_at TIMESTAMP WITH TIME ZONE,
        processing_time_ms INTEGER
      )
    `);

    // Indexes for Pre-Authorization Requests
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_patient_id ON pre_authorization_requests(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_billing_id ON pre_authorization_requests(billing_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_status ON pre_authorization_requests(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_medical_aid_name ON pre_authorization_requests(medical_aid_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_request_date ON pre_authorization_requests(request_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preauth_requests_expiry_date ON pre_authorization_requests(expiry_date) WHERE expiry_date IS NOT NULL`);

    // Indexes for Claim Status History
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_status_history_claim_id ON claim_status_history(claim_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_status_history_status ON claim_status_history(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_status_history_created_at ON claim_status_history(created_at)`);

    // Indexes for Medical Aid API Configurations
    statements.push(`CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_medical_aid_name ON medical_aid_api_configurations(medical_aid_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_provider_type ON medical_aid_api_configurations(provider_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_is_active ON medical_aid_api_configurations(is_active) WHERE is_active = true`);

    // Indexes for Claim Submissions
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_submissions_claim_id ON claim_submissions(claim_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_submissions_status ON claim_submissions(submission_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_submissions_submitted_at ON claim_submissions(submitted_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claim_submissions_external_reference_id ON claim_submissions(external_reference_id) WHERE external_reference_id IS NOT NULL`);

    // Additional indexes for enhanced medical_aid_claims
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claims_preauth_id ON medical_aid_claims(pre_authorization_id) WHERE pre_authorization_id IS NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claims_original_claim_id ON medical_aid_claims(original_claim_id) WHERE original_claim_id IS NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claims_submission_method ON medical_aid_claims(submission_method) WHERE submission_method IS NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claims_external_claim_id ON medical_aid_claims(external_claim_id) WHERE external_claim_id IS NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_claims_next_status_check_at ON medical_aid_claims(next_status_check_at) WHERE next_status_check_at IS NOT NULL`);

    return statements;
  }

  private getSprint16WorkflowSchemaStatements(): string[] {
    const statements: string[] = [];

    // Clinical Workflows Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS clinical_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_event VARCHAR(100) NOT NULL CHECK (trigger_event IN (
          'patient_check_in',
          'appointment_scheduled',
          'appointment_started',
          'appointment_completed',
          'lab_result_received',
          'vitals_recorded',
          'prescription_created',
          'triage_completed',
          'referral_created',
          'custom'
        )),
        trigger_conditions JSONB,
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Workflow Steps Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES clinical_workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type VARCHAR(50) NOT NULL CHECK (step_type IN (
          'assign_role',
          'send_notification',
          'create_task',
          'update_status',
          'create_order',
          'assign_appointment',
          'send_message',
          'execute_script',
          'wait',
          'condition'
        )),
        step_config JSONB NOT NULL,
        conditions JSONB,
        timeout_minutes INTEGER,
        retry_count INTEGER DEFAULT 0,
        is_required BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Workflow Executions Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES clinical_workflows(id),
        trigger_event VARCHAR(100) NOT NULL,
        trigger_entity_type VARCHAR(50) NOT NULL,
        trigger_entity_id UUID NOT NULL,
        patient_id UUID REFERENCES patients(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'timeout'
        )),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        execution_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Workflow Step Executions Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS workflow_step_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
        step_id UUID NOT NULL REFERENCES workflow_steps(id),
        step_order INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'running',
          'completed',
          'failed',
          'skipped',
          'timeout'
        )),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        result_data JSONB,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Workflow Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        template_data JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflows_trigger_event ON clinical_workflows(trigger_event)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON clinical_workflows(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_id, step_order)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_trigger ON workflow_executions(trigger_entity_type, trigger_entity_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_patient_id ON workflow_executions(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_step_executions_execution_id ON workflow_step_executions(execution_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_step_executions_step_id ON workflow_step_executions(step_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_step_executions_status ON workflow_step_executions(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_active ON workflow_templates(is_active)`);

    return statements;
  }

  private getSprint17CarePlansSchemaStatements(): string[] {
    const statements: string[] = [];

    // Care Plan Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plan_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'chronic_disease',
          'post_surgery',
          'preventive_care',
          'mental_health',
          'maternity',
          'pediatric',
          'geriatric',
          'rehabilitation',
          'palliative',
          'general'
        )),
        condition_code VARCHAR(50),
        condition_name VARCHAR(255),
        template_data JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Care Plans Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        template_id UUID REFERENCES care_plan_templates(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
          'draft',
          'active',
          'on_hold',
          'completed',
          'cancelled'
        )),
        start_date DATE NOT NULL,
        end_date DATE,
        target_completion_date DATE,
        primary_provider_id UUID REFERENCES users(id),
        care_team JSONB DEFAULT '[]'::jsonb,
        diagnosis_codes TEXT[],
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Care Plan Goals Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plan_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_number INTEGER NOT NULL,
        goal_text TEXT NOT NULL,
        goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN (
          'clinical',
          'functional',
          'behavioral',
          'quality_of_life',
          'symptom_management',
          'preventive',
          'education'
        )),
        target_value VARCHAR(255),
        current_value VARCHAR(255),
        measurement_unit VARCHAR(50),
        target_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN (
          'not_started',
          'in_progress',
          'achieved',
          'partially_achieved',
          'not_achieved',
          'on_hold'
        )),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Care Plan Interventions Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plan_interventions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
        intervention_number INTEGER NOT NULL,
        intervention_text TEXT NOT NULL,
        intervention_type VARCHAR(50) NOT NULL CHECK (intervention_type IN (
          'medication',
          'therapy',
          'education',
          'lifestyle',
          'monitoring',
          'referral',
          'procedure',
          'counseling',
          'other'
        )),
        frequency VARCHAR(100),
        duration VARCHAR(100),
        responsible_role VARCHAR(50),
        assigned_to UUID REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'in_progress',
          'completed',
          'cancelled',
          'on_hold'
        )),
        start_date DATE,
        end_date DATE,
        completion_date DATE,
        outcome_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Care Plan Progress Log Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plan_progress_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
        intervention_id UUID REFERENCES care_plan_interventions(id) ON DELETE CASCADE,
        progress_date DATE NOT NULL,
        progress_type VARCHAR(50) NOT NULL CHECK (progress_type IN (
          'goal_update',
          'intervention_completed',
          'milestone_reached',
          'status_change',
          'note'
        )),
        current_value VARCHAR(255),
        progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Care Plan Outcomes Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS care_plan_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        outcome_date DATE NOT NULL,
        outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN (
          'clinical_improvement',
          'symptom_reduction',
          'functional_improvement',
          'goal_achieved',
          'no_change',
          'deterioration',
          'complication'
        )),
        measurement_value VARCHAR(255),
        measurement_unit VARCHAR(50),
        baseline_value VARCHAR(255),
        improvement_percentage DECIMAL(5,2),
        notes TEXT,
        assessed_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_category ON care_plan_templates(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_condition ON care_plan_templates(condition_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_is_active ON care_plan_templates(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON care_plans(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_status ON care_plans(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_primary_provider ON care_plans(primary_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_start_date ON care_plans(start_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_care_plan_id ON care_plan_goals(care_plan_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_status ON care_plan_goals(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_target_date ON care_plan_goals(target_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_care_plan_id ON care_plan_interventions(care_plan_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_goal_id ON care_plan_interventions(goal_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_status ON care_plan_interventions(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_assigned_to ON care_plan_interventions(assigned_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_care_plan_id ON care_plan_progress_log(care_plan_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_goal_id ON care_plan_progress_log(goal_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_date ON care_plan_progress_log(progress_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_care_plan_id ON care_plan_outcomes(care_plan_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_date ON care_plan_outcomes(outcome_date)`);

    return statements;
  }

  private getSprint18ReferralManagementSchemaStatements(): string[] {
    const statements: string[] = [];

    // Referrals Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        referring_provider_id UUID NOT NULL REFERENCES users(id),
        referring_facility_name VARCHAR(255),
        referred_to_provider_id UUID REFERENCES users(id),
        referred_to_facility_name VARCHAR(255) NOT NULL,
        referred_to_facility_address TEXT,
        referred_to_facility_phone VARCHAR(50),
        referred_to_facility_email VARCHAR(255),
        referred_to_facility_webhook VARCHAR(500),
        referral_type VARCHAR(50) NOT NULL CHECK (referral_type IN (
          'specialist',
          'laboratory',
          'imaging',
          'surgery',
          'hospitalization',
          'therapy',
          'mental_health',
          'dental',
          'ophthalmology',
          'cardiology',
          'oncology',
          'other'
        )),
        specialty VARCHAR(100),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        urgency VARCHAR(20) CHECK (urgency IN ('routine', 'urgent', 'emergent')),
        reason TEXT NOT NULL,
        clinical_summary TEXT,
        relevant_history TEXT,
        current_medications TEXT,
        allergies TEXT,
        diagnostic_tests_ordered TEXT,
        requested_services TEXT,
        referral_date DATE NOT NULL,
        requested_appointment_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'draft',
          'pending',
          'sent',
          'acknowledged',
          'scheduled',
          'in_progress',
          'completed',
          'cancelled',
          'rejected',
          'expired'
        )),
        external_referral_id VARCHAR(255),
        response_received_date DATE,
        appointment_scheduled_date DATE,
        appointment_completed_date DATE,
        response_notes TEXT,
        outcome_summary TEXT,
        cancellation_reason TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Referral Attachments Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS referral_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
          'clinical_note',
          'lab_result',
          'imaging_result',
          'prescription',
          'medical_record',
          'other'
        )),
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        description TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Referral Status History Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS referral_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        change_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        changed_by UUID REFERENCES users(id),
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Referral Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS referral_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        referral_type VARCHAR(50) NOT NULL,
        specialty VARCHAR(100),
        template_data JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Referral Facilities Table (Directory)
    statements.push(`
      CREATE TABLE IF NOT EXISTS referral_facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_name VARCHAR(255) NOT NULL,
        facility_type VARCHAR(50) CHECK (facility_type IN (
          'hospital',
          'clinic',
          'specialist_practice',
          'laboratory',
          'imaging_center',
          'therapy_center',
          'other'
        )),
        specialties TEXT[],
        address TEXT,
        city VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        contact_person VARCHAR(255),
        referral_process TEXT,
        required_documents TEXT[],
        average_wait_time_days INTEGER,
        accepts_insurance BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes for Referrals
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_patient_id ON referrals(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_referring_provider ON referrals(referring_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_to_provider ON referrals(referred_to_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(referral_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_referral_date ON referrals(referral_date)`);

    // Indexes for Referral Attachments
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_attachments_referral_id ON referral_attachments(referral_id)`);

    // Indexes for Referral Status History
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_status_history_referral_id ON referral_status_history(referral_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_status_history_change_date ON referral_status_history(change_date)`);

    // Indexes for Referral Templates
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_templates_type ON referral_templates(referral_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_templates_specialty ON referral_templates(specialty)`);

    // Indexes for Referral Facilities
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_facilities_type ON referral_facilities(facility_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referral_facilities_specialties ON referral_facilities USING GIN(specialties)`);

    return statements;
  }

  private getSprint19DocumentManagementSchemaStatements(): string[] {
    const statements: string[] = [];

    // Document Versions Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        change_summary TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Document Sharing Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS document_sharing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        shared_with_user_id UUID REFERENCES users(id),
        shared_with_role VARCHAR(50),
        permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('view', 'download', 'edit')),
        shared_by UUID REFERENCES users(id),
        shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Document Signatures Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS document_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        signer_id UUID NOT NULL REFERENCES users(id),
        signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
          'electronic',
          'digital',
          'wet_signature_scan'
        )),
        signature_data TEXT,
        signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Document Tags Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS document_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        tag_name VARCHAR(100) NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(document_id, tag_name)
      )
    `);

    // Document Access Log Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS document_access_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        accessed_by UUID REFERENCES users(id),
        access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('view', 'download', 'edit', 'delete', 'share', 'sign')),
        ip_address INET,
        user_agent TEXT,
        accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes for Document Versions
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_versions_is_current ON document_versions(is_current)`);

    // Indexes for Document Sharing
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_sharing_document_id ON document_sharing(document_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_sharing_user_id ON document_sharing(shared_with_user_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_sharing_role ON document_sharing(shared_with_role)`);

    // Indexes for Document Signatures
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON document_signatures(signer_id)`);

    // Indexes for Document Tags
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_tags_tag_name ON document_tags(tag_name)`);

    // Indexes for Document Access Log
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id ON document_access_log(document_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_by ON document_access_log(accessed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at ON document_access_log(accessed_at)`);

    return statements;
  }

  private getSprint20ProviderMessagingSchemaStatements(): string[] {
    const statements: string[] = [];

    // Provider Messages Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS provider_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID,
        sender_id UUID NOT NULL REFERENCES users(id),
        recipient_id UUID REFERENCES users(id),
        recipient_role VARCHAR(50),
        recipient_team VARCHAR(100),
        subject VARCHAR(255) NOT NULL,
        message_text TEXT NOT NULL,
        message_type VARCHAR(50) NOT NULL DEFAULT 'message' CHECK (message_type IN (
          'message',
          'task',
          'alert',
          'notification',
          'referral_request',
          'consultation_request',
          'lab_result_alert',
          'critical_alert'
        )),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (status IN (
          'draft',
          'sent',
          'delivered',
          'read',
          'archived',
          'deleted'
        )),
        patient_id UUID REFERENCES patients(id),
        appointment_id UUID REFERENCES appointments(id),
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        requires_response BOOLEAN DEFAULT false,
        response_required_by TIMESTAMP WITH TIME ZONE,
        is_urgent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        delivered_at TIMESTAMP WITH TIME ZONE,
        read_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Attachments Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Threads Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject VARCHAR(255) NOT NULL,
        patient_id UUID REFERENCES patients(id),
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        participants JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_message_at TIMESTAMP WITH TIME ZONE,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Read Receipts Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        read_by UUID NOT NULL REFERENCES users(id),
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(message_id, read_by)
      )
    `);

    // Message Tasks Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        task_title VARCHAR(255) NOT NULL,
        task_description TEXT,
        assigned_to UUID NOT NULL REFERENCES users(id),
        assigned_by UUID NOT NULL REFERENCES users(id),
        due_date TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'in_progress',
          'completed',
          'cancelled'
        )),
        completed_at TIMESTAMP WITH TIME ZONE,
        completion_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) CHECK (category IN (
          'consultation',
          'referral',
          'lab_result',
          'follow_up',
          'urgent_alert',
          'general'
        )),
        subject_template VARCHAR(255) NOT NULL,
        message_template TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes for Provider Messages
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON provider_messages(sender_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON provider_messages(recipient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON provider_messages(thread_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_status ON provider_messages(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_priority ON provider_messages(priority)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON provider_messages(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON provider_messages(sent_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_messages_requires_response ON provider_messages(requires_response)`);

    // Indexes for Message Attachments
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id)`);

    // Indexes for Message Threads
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_threads_patient_id ON message_threads(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(last_message_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_threads_is_archived ON message_threads(is_archived)`);

    // Indexes for Message Read Receipts
    statements.push(`CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON message_read_receipts(message_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_read_receipts_read_by ON message_read_receipts(read_by)`);

    // Indexes for Message Tasks
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_tasks_message_id ON message_tasks(message_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_tasks_assigned_to ON message_tasks(assigned_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_tasks_status ON message_tasks(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_tasks_due_date ON message_tasks(due_date)`);

    // Indexes for Message Templates
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active)`);

    return statements;
  }

  private getSprint21EConsentSchemaStatements(): string[] {
    const statements: string[] = [];

    statements.push(`
      CREATE TABLE IF NOT EXISTS consent_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name VARCHAR(255) NOT NULL,
        template_code VARCHAR(100) NOT NULL UNIQUE,
        consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
          'treatment', 'surgery', 'procedure', 'research', 'hipaa', 'photography',
          'release_of_information', 'financial', 'telehealth', 'vaccine',
          'anesthesia', 'blood_transfusion', 'general'
        )),
        version VARCHAR(20) NOT NULL,
        language_code VARCHAR(10) DEFAULT 'en',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        required_fields JSONB DEFAULT '[]'::jsonb,
        signature_requirements JSONB NOT NULL DEFAULT '{"patient": true, "guardian": false, "witness": false, "provider": true}'::jsonb,
        validity_period_days INTEGER,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        specialty VARCHAR(100),
        procedure_codes JSONB DEFAULT '[]'::jsonb,
        procedure_snomed_codes JSONB DEFAULT '[]'::jsonb,
        procedure_cpt_codes JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expiration_date DATE
      )
    `);

    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consent_number VARCHAR(50) UNIQUE NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id),
        template_id UUID REFERENCES consent_templates(id),
        template_version VARCHAR(20) NOT NULL,
        consent_type VARCHAR(50) NOT NULL,
        appointment_id UUID REFERENCES appointments(id),
        procedure_id UUID,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        filled_fields JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending', 'signed', 'declined', 'expired', 'revoked', 'superseded'
        )),
        language_code VARCHAR(10) DEFAULT 'en',
        consent_date TIMESTAMP WITH TIME ZONE,
        valid_from TIMESTAMP WITH TIME ZONE,
        valid_until TIMESTAMP WITH TIME ZONE,
        location VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        presented_by UUID REFERENCES users(id),
        presented_at TIMESTAMP WITH TIME ZONE,
        signed_at TIMESTAMP WITH TIME ZONE,
        declined_at TIMESTAMP WITH TIME ZONE,
        decline_reason TEXT,
        revoked_at TIMESTAMP WITH TIME ZONE,
        revocation_reason TEXT,
        revoked_by UUID REFERENCES users(id),
        superseded_by UUID REFERENCES patient_consents(id),
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        procedure_snomed_code VARCHAR(20),
        procedure_snomed_term TEXT,
        procedure_cpt_code VARCHAR(10),
        diagnosis_icd10 VARCHAR(10),
        diagnosis_snomed VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    statements.push(`
      CREATE TABLE IF NOT EXISTS consent_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
        signer_role VARCHAR(50) NOT NULL CHECK (signer_role IN (
          'patient', 'guardian', 'witness', 'provider', 'legal_representative'
        )),
        signer_id UUID REFERENCES users(id),
        signer_name VARCHAR(255) NOT NULL,
        signer_relationship VARCHAR(100),
        signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
          'electronic', 'digital', 'biometric', 'typed'
        )),
        signature_data TEXT NOT NULL,
        signature_method VARCHAR(100),
        signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        geolocation JSONB,
        user_agent TEXT,
        device_info JSONB,
        verification_code VARCHAR(100),
        verified_at TIMESTAMP WITH TIME ZONE,
        is_valid BOOLEAN DEFAULT true,
        invalidated_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    statements.push(`
      CREATE TABLE IF NOT EXISTS consent_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL CHECK (action IN (
          'created', 'presented', 'viewed', 'signed', 'declined', 'revoked',
          'expired', 'superseded', 'exported', 'printed', 'emailed', 'modified'
        )),
        performed_by UUID REFERENCES users(id),
        performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        previous_state JSONB,
        new_state JSONB
      )
    `);

    statements.push(`
      CREATE TABLE IF NOT EXISTS consent_reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        consent_type VARCHAR(50) NOT NULL,
        template_id UUID REFERENCES consent_templates(id),
        due_date DATE NOT NULL,
        reminder_reason VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
        sent_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        completed_consent_id UUID REFERENCES patient_consents(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Backfill columns for tenants that may have older Sprint-21 schema variants.
    statements.push(`ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS procedure_snomed_codes JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS procedure_cpt_codes JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS procedure_snomed_code VARCHAR(20)`);
    statements.push(`ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS procedure_snomed_term TEXT`);
    statements.push(`ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS procedure_cpt_code VARCHAR(10)`);
    statements.push(`ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS diagnosis_icd10 VARCHAR(10)`);
    statements.push(`ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS diagnosis_snomed VARCHAR(20)`);

    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_templates_type ON consent_templates(consent_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_templates_code ON consent_templates(template_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_templates_active ON consent_templates(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_templates_language ON consent_templates(language_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_templates_specialty ON consent_templates(specialty)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_status ON patient_consents(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_type ON patient_consents(consent_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_date ON patient_consents(consent_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_appointment ON patient_consents(appointment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_number ON patient_consents(consent_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_valid_until ON patient_consents(valid_until)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_procedure_snomed ON patient_consents(procedure_snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_consents_diagnosis_icd10 ON patient_consents(diagnosis_icd10)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_signatures_consent ON consent_signatures(consent_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_signatures_role ON consent_signatures(signer_role)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_signatures_date ON consent_signatures(signed_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_signatures_signer ON consent_signatures(signer_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_audit_consent ON consent_audit_log(consent_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_audit_action ON consent_audit_log(action)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_audit_date ON consent_audit_log(performed_at)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_audit_user ON consent_audit_log(performed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_reminders_patient ON consent_reminders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_reminders_due_date ON consent_reminders(due_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_consent_reminders_status ON consent_reminders(status)`);

    statements.push(`DROP TRIGGER IF EXISTS update_consent_templates_updated_at ON consent_templates`);
    statements.push(`CREATE TRIGGER update_consent_templates_updated_at BEFORE UPDATE ON consent_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    statements.push(`DROP TRIGGER IF EXISTS update_patient_consents_updated_at ON patient_consents`);
    statements.push(`CREATE TRIGGER update_patient_consents_updated_at BEFORE UPDATE ON patient_consents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

    statements.push(`
      INSERT INTO consent_templates (
        template_name, template_code, consent_type, version, language_code, title, content,
        signature_requirements, validity_period_days, is_active, is_default, effective_date
      ) VALUES
      (
        'General Treatment Consent',
        'GENERAL_TREATMENT_V1',
        'treatment',
        '1.0',
        'en',
        'Consent for Medical Treatment',
        '<p>I consent to receive medical treatment at {{facility_name}}.</p>',
        '{"patient": true, "guardian": false, "witness": false, "provider": true}'::jsonb,
        365,
        true,
        true,
        CURRENT_DATE
      ),
      (
        'HIPAA Privacy Acknowledgment',
        'HIPAA_PRIVACY_V1',
        'hipaa',
        '1.0',
        'en',
        'Acknowledgment of Privacy Practices',
        '<p>I acknowledge receipt of privacy practices at {{facility_name}}.</p>',
        '{"patient": true, "guardian": false, "witness": false, "provider": false}'::jsonb,
        NULL,
        true,
        true,
        CURRENT_DATE
      ),
      (
        'Telehealth Consent',
        'TELEHEALTH_V1',
        'telehealth',
        '1.0',
        'en',
        'Consent for Telehealth Services',
        '<p>I consent to telehealth services and understand privacy and technical limitations.</p>',
        '{"patient": true, "guardian": false, "witness": false, "provider": true}'::jsonb,
        180,
        true,
        true,
        CURRENT_DATE
      )
      ON CONFLICT (template_code) DO NOTHING
    `);

    statements.push(`COMMENT ON TABLE consent_templates IS 'Consent form templates with version control'`);
    statements.push(`COMMENT ON TABLE patient_consents IS 'Patient consent records with signatures'`);
    statements.push(`COMMENT ON TABLE consent_signatures IS 'Electronic signatures for consents'`);
    statements.push(`COMMENT ON TABLE consent_audit_log IS 'Complete audit trail for consent actions'`);
    statements.push(`COMMENT ON TABLE consent_reminders IS 'Reminders for pending or expiring consents'`);

    return statements;
  }

  private getSprint31RevenueCycleSchemaStatements(): string[] {
    const statements: string[] = [];

    // Charge Master Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS charge_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        charge_code VARCHAR(50) UNIQUE NOT NULL,
        charge_description TEXT NOT NULL,
        cpt_code VARCHAR(10),
        hcpcs_code VARCHAR(10),
        revenue_code VARCHAR(10),
        standard_charge DECIMAL(10, 2) NOT NULL,
        medicare_rate DECIMAL(10, 2),
        medicaid_rate DECIMAL(10, 2),
        department VARCHAR(100),
        service_category VARCHAR(100),
        billable BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Patient Charges Table (with approval workflow columns from Migration 028)
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_charges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        charge_code VARCHAR(50) NOT NULL,
        charge_description TEXT NOT NULL,
        quantity DECIMAL(10, 2) DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_charge DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
        service_date DATE NOT NULL,
        source_type VARCHAR(100),
        source_id UUID,
        cpt_code VARCHAR(10),
        icd10_code VARCHAR(10),
        department VARCHAR(100),
        ordering_provider UUID REFERENCES users(id),
        charge_status VARCHAR(50) DEFAULT 'pending' CHECK (charge_status IN 
          ('pending', 'reviewed', 'approved', 'rejected', 'billed', 'paid', 'adjusted', 'written_off')),
        capture_method VARCHAR(50) CHECK (capture_method IN ('automatic', 'manual', 'imported')),
        captured_by UUID REFERENCES users(id),
        captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        approval_notes TEXT,
        rejection_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // DRG Assignments Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS drg_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        drg_code VARCHAR(10) NOT NULL,
        drg_description TEXT NOT NULL,
        drg_weight DECIMAL(6, 4),
        principal_diagnosis_icd10 VARCHAR(10) NOT NULL,
        principal_diagnosis_description TEXT,
        secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
        procedures JSONB DEFAULT '[]'::jsonb,
        has_cc BOOLEAN DEFAULT false,
        has_mcc BOOLEAN DEFAULT false,
        cc_mcc_list JSONB DEFAULT '[]'::jsonb,
        severity_of_illness VARCHAR(20) CHECK (severity_of_illness IN ('minor', 'moderate', 'major', 'extreme')),
        risk_of_mortality VARCHAR(20) CHECK (risk_of_mortality IN ('minor', 'moderate', 'major', 'extreme')),
        base_rate DECIMAL(10, 2),
        calculated_payment DECIMAL(10, 2) GENERATED ALWAYS AS (base_rate * drg_weight) STORED,
        assigned_date DATE DEFAULT CURRENT_DATE,
        assigned_by UUID REFERENCES users(id),
        assignment_method VARCHAR(50) CHECK (assignment_method IN ('automatic', 'coder_assigned', 'cdi_assigned')),
        status VARCHAR(50) DEFAULT 'working' CHECK (status IN ('working', 'final', 'appealed', 'adjusted')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Missed Charges Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS missed_charges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        potential_charge_code VARCHAR(50),
        potential_charge_description TEXT,
        estimated_amount DECIMAL(10, 2),
        source_type VARCHAR(100) NOT NULL,
        source_id UUID,
        service_date DATE NOT NULL,
        detected_by VARCHAR(50) DEFAULT 'system' CHECK (detected_by IN ('system', 'auditor', 'cdi_specialist')),
        detected_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'not_billable', 'duplicate', 'ignored')),
        resolved_date DATE,
        resolved_by UUID REFERENCES users(id),
        resolution_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Charge Capture Rules Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS charge_capture_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_name VARCHAR(255) NOT NULL,
        rule_description TEXT,
        trigger_type VARCHAR(100) NOT NULL,
        trigger_conditions JSONB,
        charge_code VARCHAR(50) NOT NULL,
        quantity_formula VARCHAR(255),
        department VARCHAR(100),
        active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Charge Approval Notifications Table (from Migration 028)
    statements.push(`
      CREATE TABLE IF NOT EXISTS charge_approval_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        notification_type VARCHAR(50) DEFAULT 'charge_approved' CHECK (notification_type IN ('charge_approved', 'charges_ready_for_billing')),
        notification_status VARCHAR(50) DEFAULT 'unread' CHECK (notification_status IN ('unread', 'read', 'dismissed')),
        total_charges_count INTEGER DEFAULT 0,
        total_charges_amount DECIMAL(10, 2) DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        read_by UUID REFERENCES users(id),
        read_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    // Indexes for Charge Master
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_master_code ON charge_master(charge_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_master_cpt ON charge_master(cpt_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_master_department ON charge_master(department)`);

    // Indexes for Patient Charges
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_patient ON patient_charges(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_admission ON patient_charges(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_service_date ON patient_charges(service_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_status ON patient_charges(charge_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_reviewed_by ON patient_charges(reviewed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_approved_by ON patient_charges(approved_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_patient_charges_approval_status ON patient_charges(charge_status) WHERE charge_status IN ('pending', 'reviewed', 'approved', 'rejected')`);

    // Indexes for DRG Assignments
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drg_admission ON drg_assignments(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drg_patient ON drg_assignments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drg_code ON drg_assignments(drg_code)`);

    // Indexes for Missed Charges
    statements.push(`CREATE INDEX IF NOT EXISTS idx_missed_charges_patient ON missed_charges(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_missed_charges_status ON missed_charges(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_missed_charges_service_date ON missed_charges(service_date)`);

    // Indexes for Charge Capture Rules
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_rules_trigger ON charge_capture_rules(trigger_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_rules_active ON charge_capture_rules(active)`);

    // Indexes for Charge Approval Notifications
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_notifications_admission ON charge_approval_notifications(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_notifications_patient ON charge_approval_notifications(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_notifications_status ON charge_approval_notifications(notification_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_charge_notifications_created_at ON charge_approval_notifications(created_at DESC)`);

    // Comments
    statements.push(`COMMENT ON TABLE charge_master IS 'Hospital charge master (fee schedule) with CPT/HCPCS codes'`);
    statements.push(`COMMENT ON TABLE patient_charges IS 'Individual charges posted to patient accounts with auto-capture and approval workflow tracking'`);
    statements.push(`COMMENT ON TABLE drg_assignments IS 'DRG assignments for inpatient billing with CC/MCC tracking'`);
    statements.push(`COMMENT ON TABLE missed_charges IS 'Potentially missed charges for reconciliation and recovery'`);
    statements.push(`COMMENT ON TABLE charge_capture_rules IS 'Rules for automatic charge capture from clinical activities'`);
    statements.push(`COMMENT ON TABLE charge_approval_notifications IS 'Notifications sent to accounts department when charges are approved by doctors'`);

    return statements;
  }

  private getSprint23BedManagementSchemaStatements(): string[] {
    return [
      `
      -- Beds Table
      CREATE TABLE IF NOT EXISTS beds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bed_number VARCHAR(50) NOT NULL,
        room_number VARCHAR(50) NOT NULL,
        ward_name VARCHAR(100) NOT NULL,
        floor VARCHAR(50),
        building VARCHAR(100),
        bed_type VARCHAR(50) NOT NULL CHECK (bed_type IN (
          'icu', 'general', 'pediatric', 'maternity', 'isolation', 'telemetry', 'step_down', 'observation'
        )),
        specialty VARCHAR(100),
        status VARCHAR(50) DEFAULT 'available' CHECK (status IN (
          'available', 'occupied', 'reserved', 'blocked', 'cleaning', 'maintenance', 'out_of_service'
        )),
        current_patient_id UUID REFERENCES patients(id),
        current_admission_id UUID,
        occupied_since TIMESTAMP WITH TIME ZONE,
        expected_discharge TIMESTAMP WITH TIME ZONE,
        has_equipment JSONB DEFAULT '[]'::jsonb,
        features JSONB DEFAULT '[]'::jsonb,
        is_isolation_capable BOOLEAN DEFAULT false,
        is_negative_pressure BOOLEAN DEFAULT false,
        last_cleaned_at TIMESTAMP WITH TIME ZONE,
        last_cleaned_by UUID REFERENCES users(id),
        maintenance_notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(bed_number, ward_name)
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);`,
      `CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_name);`,
      `CREATE INDEX IF NOT EXISTS idx_beds_type ON beds(bed_type);`,
      `CREATE INDEX IF NOT EXISTS idx_beds_patient ON beds(current_patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_beds_floor ON beds(floor);`,
      `
      -- Admissions Table
      CREATE TABLE IF NOT EXISTS admissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_number VARCHAR(50) UNIQUE NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_date TIMESTAMP WITH TIME ZONE NOT NULL,
        admission_time TIMESTAMP WITH TIME ZONE NOT NULL,
        admission_type VARCHAR(50) NOT NULL CHECK (admission_type IN (
          'emergency', 'elective', 'urgent', 'newborn', 'maternity', 'observation'
        )),
        admission_source VARCHAR(100),
        referring_facility VARCHAR(255),
        admitting_provider UUID REFERENCES users(id),
        admitting_diagnosis TEXT NOT NULL,
        admission_reason TEXT,
        initial_bed_id UUID REFERENCES beds(id),
        initial_ward VARCHAR(100),
        current_bed_id UUID REFERENCES beds(id),
        current_ward VARCHAR(100),
        service VARCHAR(100),
        attending_provider UUID REFERENCES users(id),
        admission_status VARCHAR(50) DEFAULT 'active' CHECK (admission_status IN (
          'active', 'discharged', 'transferred_out', 'deceased', 'eloped', 'cancelled'
        )),
        expected_los_days INTEGER,
        isolation_required BOOLEAN DEFAULT false,
        isolation_type VARCHAR(100),
        code_status VARCHAR(50),
        advance_directives TEXT,
        discharge_plan TEXT,
        estimated_discharge_date DATE,
        financial_class VARCHAR(100),
        insurance_verified BOOLEAN DEFAULT false,
        insurance_authorization VARCHAR(100),
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(admission_status);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_date ON admissions(admission_date);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_ward ON admissions(current_ward);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_bed ON admissions(current_bed_id);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_provider ON admissions(attending_provider);`,
      `CREATE INDEX IF NOT EXISTS idx_admissions_number ON admissions(admission_number);`,
      `
      -- Discharges Table
      CREATE TABLE IF NOT EXISTS discharges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        discharge_date TIMESTAMP WITH TIME ZONE NOT NULL,
        discharge_time TIMESTAMP WITH TIME ZONE NOT NULL,
        discharge_type VARCHAR(50) NOT NULL CHECK (discharge_type IN (
          'routine', 'against_medical_advice', 'transfer_to_facility', 'home_health', 'deceased', 'hospice', 'left_without_being_seen', 'still_patient'
        )),
        discharge_disposition VARCHAR(100) NOT NULL,
        discharge_destination VARCHAR(255),
        discharge_diagnosis TEXT NOT NULL,
        discharge_condition VARCHAR(100),
        discharge_provider UUID REFERENCES users(id),
        discharge_instructions TEXT,
        medications_prescribed TEXT,
        follow_up_appointments TEXT,
        follow_up_provider UUID REFERENCES users(id),
        follow_up_date DATE,
        restrictions TEXT,
        diet_instructions TEXT,
        activity_level TEXT,
        wound_care TEXT,
        home_health_ordered BOOLEAN DEFAULT false,
        dme_ordered BOOLEAN DEFAULT false,
        dme_details TEXT,
        transportation_arranged BOOLEAN DEFAULT false,
        patient_education_provided BOOLEAN DEFAULT false,
        discharge_summary_completed BOOLEAN DEFAULT false,
        discharge_summary_sent_date TIMESTAMP WITH TIME ZONE,
        length_of_stay_hours INTEGER,
        readmission_risk VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_discharges_admission ON discharges(admission_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discharges_patient ON discharges(patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discharges_date ON discharges(discharge_date);`,
      `CREATE INDEX IF NOT EXISTS idx_discharges_type ON discharges(discharge_type);`,
      `
      -- Transfers Table
      CREATE TABLE IF NOT EXISTS patient_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        transfer_date TIMESTAMP WITH TIME ZONE NOT NULL,
        transfer_time TIMESTAMP WITH TIME ZONE NOT NULL,
        transfer_type VARCHAR(50) NOT NULL CHECK (transfer_type IN (
          'internal_ward', 'internal_bed', 'external_facility', 'icu_to_floor', 'floor_to_icu', 'service_change'
        )),
        from_bed_id UUID REFERENCES beds(id),
        from_ward VARCHAR(100),
        from_service VARCHAR(100),
        to_bed_id UUID REFERENCES beds(id),
        to_ward VARCHAR(100),
        to_service VARCHAR(100),
        to_facility VARCHAR(255),
        transfer_reason TEXT NOT NULL,
        clinical_reason TEXT,
        accepting_provider UUID REFERENCES users(id),
        transferring_provider UUID REFERENCES users(id),
        patient_condition VARCHAR(100),
        mode_of_transport VARCHAR(100),
        equipment_needed TEXT,
        special_instructions TEXT,
        transfer_accepted BOOLEAN DEFAULT true,
        transfer_completed BOOLEAN DEFAULT false,
        transfer_completed_time TIMESTAMP WITH TIME ZONE,
        cancelled BOOLEAN DEFAULT false,
        cancellation_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_admission ON patient_transfers(admission_id);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_patient ON patient_transfers(patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_date ON patient_transfers(transfer_date);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_from_bed ON patient_transfers(from_bed_id);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_to_bed ON patient_transfers(to_bed_id);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_transfers_type ON patient_transfers(transfer_type);`,
      `
      -- Bed Assignments Table
      CREATE TABLE IF NOT EXISTS bed_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bed_id UUID NOT NULL REFERENCES beds(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        assigned_date TIMESTAMP WITH TIME ZONE NOT NULL,
        assigned_time TIMESTAMP WITH TIME ZONE NOT NULL,
        assigned_by UUID REFERENCES users(id),
        released_date TIMESTAMP WITH TIME ZONE,
        released_time TIMESTAMP WITH TIME ZONE,
        released_by UUID REFERENCES users(id),
        assignment_reason VARCHAR(255),
        duration_hours INTEGER,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_bed_assignments_bed ON bed_assignments(bed_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient ON bed_assignments(patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bed_assignments_admission ON bed_assignments(admission_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bed_assignments_active ON bed_assignments(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_bed_assignments_date ON bed_assignments(assigned_date);`,
      `
      -- Bed Status Log Table
      CREATE TABLE IF NOT EXISTS bed_status_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bed_id UUID NOT NULL REFERENCES beds(id),
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        previous_patient_id UUID REFERENCES patients(id),
        new_patient_id UUID REFERENCES patients(id),
        changed_by UUID REFERENCES users(id),
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        change_reason TEXT,
        notes TEXT
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_bed_status_log_bed ON bed_status_log(bed_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bed_status_log_date ON bed_status_log(changed_at);`,
      `
      -- Census Snapshots Table
      CREATE TABLE IF NOT EXISTS census_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        snapshot_date DATE NOT NULL,
        snapshot_time TIME NOT NULL DEFAULT '00:00',
        ward_name VARCHAR(100),
        total_beds INTEGER NOT NULL,
        occupied_beds INTEGER NOT NULL,
        available_beds INTEGER NOT NULL,
        reserved_beds INTEGER DEFAULT 0,
        blocked_beds INTEGER DEFAULT 0,
        cleaning_beds INTEGER DEFAULT 0,
        occupancy_rate DECIMAL(5,2),
        average_los DECIMAL(5,2),
        admissions_today INTEGER DEFAULT 0,
        discharges_today INTEGER DEFAULT 0,
        transfers_in_today INTEGER DEFAULT 0,
        transfers_out_today INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(snapshot_date, snapshot_time, ward_name)
      );
      `,
      `CREATE INDEX IF NOT EXISTS idx_census_snapshots_date ON census_snapshots(snapshot_date);`,
      `CREATE INDEX IF NOT EXISTS idx_census_snapshots_ward ON census_snapshots(ward_name);`,
      `
      -- Insert sample wards and beds
      INSERT INTO beds (bed_number, room_number, ward_name, floor, building, bed_type, status) VALUES
      ('ICU-01', 'ICU-101', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
      ('ICU-02', 'ICU-102', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
      ('ICU-03', 'ICU-103', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
      ('ICU-04', 'ICU-104', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
      ('MED-01', '201', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('MED-02', '201', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('MED-03', '202', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('MED-04', '202', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('MED-05', '203', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('MED-06', '203', 'Medical Ward', '3', 'Main', 'general', 'available'),
      ('PED-01', 'P101', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),
      ('PED-02', 'P102', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),
      ('PED-03', 'P103', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),
      ('MAT-01', 'M101', 'Maternity', '5', 'Main', 'maternity', 'available'),
      ('MAT-02', 'M102', 'Maternity', '5', 'Main', 'maternity', 'available'),
      ('MAT-03', 'M103', 'Maternity', '5', 'Main', 'maternity', 'available')
      ON CONFLICT DO NOTHING;
      `
    ];
  }

  // =====================================================================================================================
  // Sprint 26: Operating Room Management
  // =====================================================================================================================
  private getSprint26OperatingRoomSchemaStatements(): string[] {
    const statements: string[] = [];

    // Operating Rooms Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS operating_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_number VARCHAR(20) UNIQUE NOT NULL,
        room_name VARCHAR(100) NOT NULL,
        location VARCHAR(100),
        room_type VARCHAR(50) CHECK (room_type IN ('general', 'cardiac', 'ortho', 'neuro', 'vascular', 'minor_procedure')),
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance', 'offline')),
        has_laminar_flow BOOLEAN DEFAULT false,
        has_c_arm BOOLEAN DEFAULT false,
        has_microscope BOOLEAN DEFAULT false,
        has_robot BOOLEAN DEFAULT false,
        equipment_list JSONB DEFAULT '[]'::jsonb,
        capacity INTEGER DEFAULT 1,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Surgical Cases Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS surgical_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_number VARCHAR(50) UNIQUE NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id),
        appointment_id UUID REFERENCES appointments(id),
        admission_id UUID REFERENCES admissions(id),
        operating_room_id UUID REFERENCES operating_rooms(id),
        scheduled_date DATE NOT NULL,
        scheduled_start_time TIME NOT NULL,
        scheduled_end_time TIME NOT NULL,
        actual_start_time TIMESTAMP WITH TIME ZONE,
        actual_end_time TIMESTAMP WITH TIME ZONE,
        patient_in_room_time TIMESTAMP WITH TIME ZONE,
        patient_out_room_time TIMESTAMP WITH TIME ZONE,
        procedure_name TEXT NOT NULL,
        procedure_code_cpt VARCHAR(10),
        procedure_code_snomed VARCHAR(20),
        procedure_type VARCHAR(50) CHECK (procedure_type IN ('elective', 'urgent', 'emergent', 'trauma')),
        surgical_approach VARCHAR(50) CHECK (surgical_approach IN ('open', 'laparoscopic', 'robotic', 'endoscopic', 'minimally_invasive')),
        laterality VARCHAR(20) CHECK (laterality IN ('left', 'right', 'bilateral', 'not_applicable')),
        primary_diagnosis TEXT NOT NULL,
        primary_diagnosis_icd10 VARCHAR(10),
        primary_diagnosis_snomed VARCHAR(20),
        secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
        primary_surgeon_id UUID REFERENCES users(id),
        assistant_surgeon_id UUID REFERENCES users(id),
        anesthesiologist_id UUID REFERENCES users(id),
        scrub_nurse_id UUID REFERENCES users(id),
        circulating_nurse_id UUID REFERENCES users(id),
        additional_staff JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'patient_arrived', 'in_progress', 'completed', 'cancelled', 'postponed', 'no_show')),
        case_priority INTEGER DEFAULT 3 CHECK (case_priority BETWEEN 1 AND 5),
        pre_op_diagnosis TEXT,
        post_op_diagnosis TEXT,
        findings TEXT,
        procedure_performed TEXT,
        complications TEXT,
        estimated_blood_loss INTEGER,
        specimens_sent JSONB DEFAULT '[]'::jsonb,
        drains_placed JSONB DEFAULT '[]'::jsonb,
        implants_used JSONB DEFAULT '[]'::jsonb,
        anesthesia_type VARCHAR(50) CHECK (anesthesia_type IN ('general', 'regional', 'local', 'MAC', 'spinal', 'epidural')),
        anesthesia_start_time TIMESTAMP WITH TIME ZONE,
        anesthesia_end_time TIMESTAMP WITH TIME ZONE,
        disposition VARCHAR(50) CHECK (disposition IN ('pacu', 'icu', 'floor', 'home', 'observation')),
        consent_id UUID REFERENCES patient_consents(id),
        case_cancelled_reason TEXT,
        case_postponed_reason TEXT,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Surgical Preference Cards
    statements.push(`
      CREATE TABLE IF NOT EXISTS surgical_preference_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgeon_id UUID NOT NULL REFERENCES users(id),
        procedure_name VARCHAR(255) NOT NULL,
        procedure_code_cpt VARCHAR(10),
        preferred_or_type VARCHAR(50),
        preferred_position VARCHAR(50) CHECK (preferred_position IN ('supine', 'prone', 'lateral', 'lithotomy', 'trendelenburg', 'reverse_trendelenburg')),
        preferred_anesthesia VARCHAR(50),
        required_equipment JSONB DEFAULT '[]'::jsonb,
        preferred_instruments JSONB DEFAULT '[]'::jsonb,
        suture_preferences JSONB DEFAULT '[]'::jsonb,
        supply_list JSONB DEFAULT '[]'::jsonb,
        implant_options JSONB DEFAULT '[]'::jsonb,
        preferred_scrub_tech VARCHAR(255),
        special_instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(surgeon_id, procedure_name, version)
      )
    `);

    // OR Block Schedule
    statements.push(`
      CREATE TABLE IF NOT EXISTS or_block_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
        surgeon_id UUID REFERENCES users(id),
        service_name VARCHAR(100),
        day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        effective_date DATE NOT NULL,
        expiration_date DATE,
        block_type VARCHAR(50) CHECK (block_type IN ('dedicated', 'shared', 'open', 'emergency_only')),
        is_recurring BOOLEAN DEFAULT true,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Surgical Implants
    statements.push(`
      CREATE TABLE IF NOT EXISTS surgical_implants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        implant_name VARCHAR(255) NOT NULL,
        implant_type VARCHAR(100),
        manufacturer VARCHAR(255),
        catalog_number VARCHAR(100),
        lot_number VARCHAR(100),
        serial_number VARCHAR(100),
        expiration_date DATE,
        udi VARCHAR(255),
        udi_di VARCHAR(100),
        udi_pi VARCHAR(100),
        charge_code VARCHAR(50),
        unit_cost DECIMAL(10, 2),
        billable BOOLEAN DEFAULT true,
        implanted_by UUID REFERENCES users(id),
        implanted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        body_site VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // OR Supply Usage
    statements.push(`
      CREATE TABLE IF NOT EXISTS or_supply_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        supply_name VARCHAR(255) NOT NULL,
        supply_code VARCHAR(50),
        quantity_used INTEGER NOT NULL,
        unit_of_measure VARCHAR(20),
        unit_cost DECIMAL(10, 2),
        total_cost DECIMAL(10, 2),
        charged_to_patient BOOLEAN DEFAULT true,
        charge_code VARCHAR(50),
        recorded_by UUID REFERENCES users(id),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // OR Turnover Log
    statements.push(`
      CREATE TABLE IF NOT EXISTS or_turnover_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
        surgical_case_id UUID REFERENCES surgical_cases(id),
        patient_out_time TIMESTAMP WITH TIME ZONE,
        cleaning_start_time TIMESTAMP WITH TIME ZONE,
        cleaning_end_time TIMESTAMP WITH TIME ZONE,
        next_patient_in_time TIMESTAMP WITH TIME ZONE,
        turnover_minutes INTEGER,
        delay_reason TEXT,
        delay_minutes INTEGER,
        cleaned_by UUID REFERENCES users(id),
        verified_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_operating_rooms_status ON operating_rooms(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_operating_rooms_type ON operating_rooms(room_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_operating_rooms_active ON operating_rooms(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_patient ON surgical_cases(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_date ON surgical_cases(scheduled_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_status ON surgical_cases(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_surgeon ON surgical_cases(primary_surgeon_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_or ON surgical_cases(operating_room_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_procedure_cpt ON surgical_cases(procedure_code_cpt)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_surgical_cases_diagnosis_icd10 ON surgical_cases(primary_diagnosis_icd10)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preference_cards_surgeon ON surgical_preference_cards(surgeon_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preference_cards_procedure ON surgical_preference_cards(procedure_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_or_block_room ON or_block_schedule(operating_room_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_or_block_surgeon ON or_block_schedule(surgeon_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_or_block_dow ON or_block_schedule(day_of_week)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_implants_case ON surgical_implants(surgical_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_implants_udi ON surgical_implants(udi)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_implants_lot ON surgical_implants(lot_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_implants_serial ON surgical_implants(serial_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_supply_usage_case ON or_supply_usage(surgical_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_turnover_room ON or_turnover_log(operating_room_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_turnover_case ON or_turnover_log(surgical_case_id)`);

    // Comments
    statements.push(`COMMENT ON TABLE operating_rooms IS 'Operating room configuration and equipment tracking'`);
    statements.push(`COMMENT ON TABLE surgical_cases IS 'Complete surgical case tracking from scheduling to completion'`);
    statements.push(`COMMENT ON TABLE surgical_preference_cards IS 'Surgeon preferences for specific procedures'`);
    statements.push(`COMMENT ON TABLE surgical_implants IS 'FDA-compliant implant tracking with UDI (Unique Device Identifier)'`);
    statements.push(`COMMENT ON TABLE or_supply_usage IS 'Surgical supply usage and charge capture'`);
    statements.push(`COMMENT ON TABLE or_block_schedule IS 'OR block time scheduling for surgeons/services'`);
    statements.push(`COMMENT ON TABLE or_turnover_log IS 'OR efficiency tracking and turnover times'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 27: Anesthesia Module
  // =====================================================================================================================
  private getSprint27AnesthesiaSchemaStatements(): string[] {
    const statements: string[] = [];

    // Pre-Anesthesia Assessments
    statements.push(`
      CREATE TABLE IF NOT EXISTS pre_anesthesia_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        asa_status VARCHAR(10) CHECK (asa_status IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'E')),
        asa_modifier VARCHAR(10),
        mallampati_score INTEGER CHECK (mallampati_score BETWEEN 1 AND 4),
        mouth_opening VARCHAR(20),
        neck_mobility VARCHAR(50),
        thyromental_distance VARCHAR(20),
        dentition VARCHAR(100),
        airway_risk VARCHAR(20) CHECK (airway_risk IN ('low', 'moderate', 'high')),
        cardiac_history TEXT,
        cardiac_exam_findings TEXT,
        ecg_findings TEXT,
        recent_ecg_date DATE,
        respiratory_history TEXT,
        respiratory_exam_findings TEXT,
        chest_xray_findings TEXT,
        recent_cxr_date DATE,
        hemoglobin DECIMAL(4, 1),
        platelet_count INTEGER,
        inr DECIMAL(3, 2),
        creatinine DECIMAL(4, 2),
        glucose INTEGER,
        recent_labs_date DATE,
        drug_allergies JSONB DEFAULT '[]'::jsonb,
        current_medications JSONB DEFAULT '[]'::jsonb,
        last_oral_intake TIMESTAMP WITH TIME ZONE,
        npo_status BOOLEAN DEFAULT false,
        planned_anesthesia_type VARCHAR(50) CHECK (planned_anesthesia_type IN ('general', 'regional', 'spinal', 'epidural', 'MAC', 'local', 'combined')),
        planned_airway VARCHAR(50) CHECK (planned_airway IN ('ETT', 'LMA', 'spontaneous', 'mask', 'nasal_cannula')),
        special_considerations TEXT,
        anesthesia_risk VARCHAR(20) CHECK (anesthesia_risk IN ('low', 'moderate', 'high', 'very_high')),
        risk_factors TEXT,
        comorbidities JSONB DEFAULT '[]'::jsonb,
        anesthesia_consent_obtained BOOLEAN DEFAULT false,
        consent_obtained_by UUID REFERENCES users(id),
        consent_obtained_at TIMESTAMP WITH TIME ZONE,
        assessed_by UUID NOT NULL REFERENCES users(id),
        assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Anesthesia Records
    statements.push(`
      CREATE TABLE IF NOT EXISTS anesthesia_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        anesthesia_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        anesthesia_end_time TIMESTAMP WITH TIME ZONE,
        surgery_start_time TIMESTAMP WITH TIME ZONE,
        surgery_end_time TIMESTAMP WITH TIME ZONE,
        anesthesia_type VARCHAR(50) NOT NULL,
        airway_management VARCHAR(50),
        ett_size VARCHAR(10),
        ett_depth VARCHAR(10),
        induction_medications JSONB DEFAULT '[]'::jsonb,
        induction_notes TEXT,
        maintenance_technique VARCHAR(50) CHECK (maintenance_technique IN ('inhalational', 'TIVA', 'balanced', 'regional')),
        maintenance_agents JSONB DEFAULT '[]'::jsonb,
        monitors_used JSONB DEFAULT '["ECG", "NIBP", "SpO2", "EtCO2", "Temp"]'::jsonb,
        medications_administered JSONB DEFAULT '[]'::jsonb,
        crystalloids_ml INTEGER DEFAULT 0,
        colloids_ml INTEGER DEFAULT 0,
        blood_products JSONB DEFAULT '[]'::jsonb,
        estimated_blood_loss INTEGER,
        urine_output INTEGER,
        drain_output INTEGER,
        ventilation_mode VARCHAR(50),
        fio2 DECIMAL(3, 2),
        tidal_volume INTEGER,
        respiratory_rate INTEGER,
        peep INTEGER,
        intraop_events JSONB DEFAULT '[]'::jsonb,
        complications TEXT,
        emergence_time TIMESTAMP WITH TIME ZONE,
        extubation_time TIMESTAMP WITH TIME ZONE,
        emergence_medications JSONB DEFAULT '[]'::jsonb,
        emergence_notes TEXT,
        anesthesiologist_id UUID NOT NULL REFERENCES users(id),
        crna_id UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Anesthesia Vitals
    statements.push(`
      CREATE TABLE IF NOT EXISTS anesthesia_vitals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        anesthesia_record_id UUID NOT NULL REFERENCES anesthesia_records(id) ON DELETE CASCADE,
        chart_time TIMESTAMP WITH TIME ZONE NOT NULL,
        heart_rate INTEGER,
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        blood_pressure_mean INTEGER,
        respiratory_rate INTEGER,
        spo2 INTEGER,
        etco2 INTEGER,
        temperature DECIMAL(4, 2),
        bis_value INTEGER,
        mac DECIMAL(3, 2),
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(anesthesia_record_id, chart_time)
      )
    `);

    // PACU Records
    statements.push(`
      CREATE TABLE IF NOT EXISTS pacu_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        anesthesia_record_id UUID REFERENCES anesthesia_records(id),
        arrival_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        arrival_from VARCHAR(50) DEFAULT 'OR',
        aldrete_score_admission INTEGER CHECK (aldrete_score_admission BETWEEN 0 AND 10),
        aldrete_score_discharge INTEGER CHECK (aldrete_score_discharge BETWEEN 0 AND 10),
        aldrete_components JSONB,
        pain_score_admission INTEGER CHECK (pain_score_admission BETWEEN 0 AND 10),
        pain_score_discharge INTEGER CHECK (pain_score_discharge BETWEEN 0 AND 10),
        pain_management JSONB DEFAULT '[]'::jsonb,
        ponv_score INTEGER CHECK (ponv_score BETWEEN 0 AND 3),
        antiemetics_given JSONB DEFAULT '[]'::jsonb,
        complications TEXT,
        interventions JSONB DEFAULT '[]'::jsonb,
        discharge_time TIMESTAMP WITH TIME ZONE,
        discharged_to VARCHAR(50) CHECK (discharged_to IN ('floor', 'icu', 'stepdown', 'home', 'observation')),
        discharge_criteria_met BOOLEAN DEFAULT false,
        pacu_nurse_id UUID REFERENCES users(id),
        discharge_approved_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Anesthesia Billing
    statements.push(`
      CREATE TABLE IF NOT EXISTS anesthesia_billing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
        anesthesia_record_id UUID REFERENCES anesthesia_records(id),
        base_units INTEGER NOT NULL,
        time_units DECIMAL(4, 2) NOT NULL,
        modifying_units INTEGER DEFAULT 0,
        total_units DECIMAL(5, 2) GENERATED ALWAYS AS (base_units + time_units + modifying_units) STORED,
        anesthesia_cpt_code VARCHAR(10),
        modifiers VARCHAR(20),
        anesthesia_start TIMESTAMP WITH TIME ZONE NOT NULL,
        anesthesia_end TIMESTAMP WITH TIME ZONE NOT NULL,
        total_minutes INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (anesthesia_end - anesthesia_start))/60) STORED,
        additional_procedures JSONB DEFAULT '[]'::jsonb,
        conversion_factor DECIMAL(8, 2) DEFAULT 22.00,
        total_charge DECIMAL(10, 2) GENERATED ALWAYS AS ((base_units + time_units + modifying_units) * conversion_factor) STORED,
        billed_at TIMESTAMP WITH TIME ZONE,
        billed_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preanesthesia_case ON pre_anesthesia_assessments(surgical_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preanesthesia_patient ON pre_anesthesia_assessments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_preanesthesia_assessor ON pre_anesthesia_assessments(assessed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_record_case ON anesthesia_records(surgical_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_record_patient ON anesthesia_records(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_record_provider ON anesthesia_records(anesthesiologist_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_vitals_record ON anesthesia_vitals(anesthesia_record_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_vitals_time ON anesthesia_vitals(chart_time)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pacu_case ON pacu_records(surgical_case_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pacu_patient ON pacu_records(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pacu_nurse ON pacu_records(pacu_nurse_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anesthesia_billing_case ON anesthesia_billing(surgical_case_id)`);

    // Comments
    statements.push(`COMMENT ON TABLE pre_anesthesia_assessments IS 'Pre-operative anesthesia evaluation and planning'`);
    statements.push(`COMMENT ON TABLE anesthesia_records IS 'Intraoperative anesthesia documentation'`);
    statements.push(`COMMENT ON TABLE anesthesia_vitals IS 'Real-time vitals charting during anesthesia (every 5 minutes)'`);
    statements.push(`COMMENT ON TABLE pacu_records IS 'Post-anesthesia care unit documentation with Aldrete scoring'`);
    statements.push(`COMMENT ON TABLE anesthesia_billing IS 'Anesthesia billing with ASA base units and time units'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 28: BCMA Medication Safety
  // =====================================================================================================================
  private getSprint28BCMASchemaStatements(): string[] {
    const statements: string[] = [];

    // Medication Administration Records
    statements.push(`
      CREATE TABLE IF NOT EXISTS medication_administration_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL REFERENCES prescriptions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        medication_name VARCHAR(255) NOT NULL,
        medication_barcode VARCHAR(100),
        dose VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        route VARCHAR(50) NOT NULL,
        right_patient_verified BOOLEAN DEFAULT false,
        right_medication_verified BOOLEAN DEFAULT false,
        right_dose_verified BOOLEAN DEFAULT false,
        right_route_verified BOOLEAN DEFAULT false,
        right_time_verified BOOLEAN DEFAULT false,
        patient_wristband_scanned BOOLEAN DEFAULT false,
        patient_barcode VARCHAR(100),
        medication_barcode_scanned BOOLEAN DEFAULT false,
        scan_timestamp TIMESTAMP WITH TIME ZONE,
        scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
        actual_administration_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        administration_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (administration_status IN ('pending', 'administered', 'refused', 'omitted', 'held', 'not_available')),
        administered_by UUID NOT NULL REFERENCES users(id),
        witnessed_by UUID REFERENCES users(id),
        administration_site VARCHAR(100),
        patient_response TEXT,
        adverse_reaction BOOLEAN DEFAULT false,
        adverse_reaction_details TEXT,
        refusal_reason TEXT,
        omission_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Medication Barcode Master
    statements.push(`
      CREATE TABLE IF NOT EXISTS medication_barcode_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medication_name VARCHAR(255) NOT NULL,
        generic_name VARCHAR(255),
        brand_name VARCHAR(255),
        barcode VARCHAR(100) NOT NULL UNIQUE,
        ndc_code VARCHAR(20),
        strength VARCHAR(100),
        unit VARCHAR(50),
        form VARCHAR(100),
        route VARCHAR(50),
        manufacturer VARCHAR(255),
        is_high_alert BOOLEAN DEFAULT false,
        is_controlled BOOLEAN DEFAULT false,
        look_alike_sound_alike JSONB DEFAULT '[]'::jsonb,
        contraindications TEXT,
        allergies_to_check JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Patient Wristbands
    statements.push(`
      CREATE TABLE IF NOT EXISTS patient_wristbands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        barcode VARCHAR(100) NOT NULL UNIQUE,
        wristband_type VARCHAR(50) DEFAULT 'standard' CHECK (wristband_type IN ('standard', 'allergy', 'fall_risk', 'dnr', 'isolation')),
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        issued_by UUID REFERENCES users(id),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        deactivated_at TIMESTAMP WITH TIME ZONE,
        deactivated_by UUID REFERENCES users(id),
        deactivation_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Medication Alerts
    statements.push(`
      CREATE TABLE IF NOT EXISTS medication_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        prescription_id UUID REFERENCES prescriptions(id),
        mar_id UUID REFERENCES medication_administration_records(id),
        alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('allergy', 'interaction', 'duplicate_therapy', 'high_alert', 'dose_range', 'contraindication', 'renal_dosing', 'hepatic_dosing')),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
        alert_message TEXT NOT NULL,
        alert_details JSONB,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        override_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // BCMA Audit Log
    statements.push(`
      CREATE TABLE IF NOT EXISTS bcma_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mar_id UUID REFERENCES medication_administration_records(id),
        action VARCHAR(100) NOT NULL,
        action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id UUID NOT NULL REFERENCES users(id),
        patient_id UUID REFERENCES patients(id),
        barcode_scanned VARCHAR(100),
        scan_result VARCHAR(50),
        ip_address VARCHAR(50),
        device_id VARCHAR(100),
        location VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_mar_prescription ON medication_administration_records(prescription_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_mar_patient ON medication_administration_records(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_mar_scheduled_time ON medication_administration_records(scheduled_time)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_mar_status ON medication_administration_records(administration_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_mar_administered_by ON medication_administration_records(administered_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_barcode_code ON medication_barcode_master(barcode)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_barcode_name ON medication_barcode_master(medication_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_barcode_high_alert ON medication_barcode_master(is_high_alert)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_wristband_patient ON patient_wristbands(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_wristband_barcode ON patient_wristbands(barcode)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_wristband_active ON patient_wristbands(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_alert_patient ON medication_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_alert_prescription ON medication_alerts(prescription_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_alert_severity ON medication_alerts(severity)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_med_alert_acknowledged ON medication_alerts(acknowledged)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_bcma_audit_mar ON bcma_audit_log(mar_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_bcma_audit_user ON bcma_audit_log(user_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_bcma_audit_timestamp ON bcma_audit_log(action_timestamp)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_bcma_audit_action ON bcma_audit_log(action)`);

    // Comments
    statements.push(`COMMENT ON TABLE medication_administration_records IS 'Complete medication administration documentation with 5 Rights verification'`);
    statements.push(`COMMENT ON TABLE medication_barcode_master IS 'Master list of medication barcodes for verification'`);
    statements.push(`COMMENT ON TABLE patient_wristbands IS 'Patient identification wristbands with barcodes'`);
    statements.push(`COMMENT ON TABLE medication_alerts IS 'Real-time medication safety alerts'`);
    statements.push(`COMMENT ON TABLE bcma_audit_log IS 'Complete audit trail for all BCMA activities'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 29: Blood Bank Management
  // =====================================================================================================================
  private getSprint29BloodBankSchemaStatements(): string[] {
    const statements: string[] = [];

    // Blood Donors
    statements.push(`
      CREATE TABLE IF NOT EXISTS blood_donors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20) NOT NULL,
        national_id VARCHAR(50),
        phone VARCHAR(50),
        email VARCHAR(100),
        address TEXT,
        blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A', 'B', 'AB', 'O')),
        rh_factor VARCHAR(10) NOT NULL CHECK (rh_factor IN ('positive', 'negative')),
        donor_type VARCHAR(50) DEFAULT 'voluntary' CHECK (donor_type IN ('voluntary', 'replacement', 'directed', 'autologous')),
        donor_status VARCHAR(50) DEFAULT 'active' CHECK (donor_status IN ('active', 'deferred', 'permanently_deferred', 'inactive')),
        last_donation_date DATE,
        total_donations INTEGER DEFAULT 0,
        deferral_reason TEXT,
        deferral_until DATE,
        willing_to_donate BOOLEAN DEFAULT true,
        preferred_contact VARCHAR(50) DEFAULT 'phone',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Blood Donations
    statements.push(`
      CREATE TABLE IF NOT EXISTS blood_donations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        donation_number VARCHAR(50) UNIQUE NOT NULL,
        donor_id UUID NOT NULL REFERENCES blood_donors(id),
        donation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        donation_type VARCHAR(50) NOT NULL CHECK (donation_type IN ('whole_blood', 'plasma', 'platelets', 'double_red_cells')),
        volume_collected INTEGER NOT NULL,
        hemoglobin DECIMAL(4, 1),
        blood_pressure VARCHAR(20),
        pulse INTEGER,
        temperature DECIMAL(4, 2),
        weight DECIMAL(5, 2),
        screening_passed BOOLEAN DEFAULT true,
        screening_notes TEXT,
        collection_site VARCHAR(100),
        phlebotomist_id UUID REFERENCES users(id),
        adverse_event BOOLEAN DEFAULT false,
        adverse_event_details TEXT,
        bag_number VARCHAR(50) UNIQUE,
        anticoagulant VARCHAR(50) DEFAULT 'CPDA-1',
        abo_group_confirmed VARCHAR(5),
        rh_factor_confirmed VARCHAR(10),
        infection_screening_status VARCHAR(50) CHECK (infection_screening_status IN ('pending', 'cleared', 'rejected')),
        hiv_test_result VARCHAR(20),
        hbsag_test_result VARCHAR(20),
        hcv_test_result VARCHAR(20),
        syphilis_test_result VARCHAR(20),
        malaria_test_result VARCHAR(20),
        donation_status VARCHAR(50) DEFAULT 'collected' CHECK (donation_status IN ('collected', 'tested', 'cleared', 'quarantined', 'discarded', 'issued')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Blood Inventory
    statements.push(`
      CREATE TABLE IF NOT EXISTS blood_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        donation_id UUID NOT NULL REFERENCES blood_donations(id),
        component_type VARCHAR(50) NOT NULL CHECK (component_type IN ('whole_blood', 'packed_rbc', 'ffp', 'platelets', 'cryoprecipitate', 'plasma')),
        unit_number VARCHAR(50) UNIQUE NOT NULL,
        blood_group VARCHAR(5) NOT NULL,
        rh_factor VARCHAR(10) NOT NULL,
        volume_ml INTEGER NOT NULL,
        collection_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        storage_location VARCHAR(100),
        storage_temperature DECIMAL(4, 2),
        status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'issued', 'expired', 'discarded', 'transfused')),
        visual_inspection_passed BOOLEAN DEFAULT true,
        inspection_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Blood Cross Match
    statements.push(`
      CREATE TABLE IF NOT EXISTS blood_cross_match (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        inventory_id UUID NOT NULL REFERENCES blood_inventory(id),
        requested_by UUID NOT NULL REFERENCES users(id),
        requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        urgency VARCHAR(50) DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
        patient_blood_group VARCHAR(5) NOT NULL,
        patient_rh_factor VARCHAR(10) NOT NULL,
        major_cross_match VARCHAR(50) CHECK (major_cross_match IN ('compatible', 'incompatible', 'pending')),
        minor_cross_match VARCHAR(50) CHECK (minor_cross_match IN ('compatible', 'incompatible', 'pending')),
        antibody_screen VARCHAR(50) CHECK (antibody_screen IN ('negative', 'positive', 'pending')),
        cross_match_result VARCHAR(50) DEFAULT 'pending' CHECK (cross_match_result IN ('pending', 'compatible', 'incompatible', 'conditional')),
        result_date TIMESTAMP WITH TIME ZONE,
        result_notes TEXT,
        performed_by UUID REFERENCES users(id),
        verified_by UUID REFERENCES users(id),
        expires_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Blood Transfusions
    statements.push(`
      CREATE TABLE IF NOT EXISTS blood_transfusions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        inventory_id UUID NOT NULL REFERENCES blood_inventory(id),
        cross_match_id UUID REFERENCES blood_cross_match(id),
        ordered_by UUID NOT NULL REFERENCES users(id),
        order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        indication TEXT NOT NULL,
        urgency VARCHAR(50) DEFAULT 'routine',
        pre_transfusion_vitals JSONB,
        consent_obtained BOOLEAN DEFAULT false,
        consent_obtained_by UUID REFERENCES users(id),
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        volume_transfused INTEGER,
        transfusion_vitals JSONB DEFAULT '[]'::jsonb,
        administered_by UUID NOT NULL REFERENCES users(id),
        monitored_by UUID REFERENCES users(id),
        transfusion_reaction BOOLEAN DEFAULT false,
        reaction_type VARCHAR(100),
        reaction_severity VARCHAR(50) CHECK (reaction_severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
        reaction_time TIMESTAMP WITH TIME ZONE,
        reaction_management TEXT,
        transfusion_status VARCHAR(50) DEFAULT 'ordered' CHECK (transfusion_status IN ('ordered', 'in_progress', 'completed', 'stopped', 'reaction_occurred')),
        completion_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donors_group ON blood_donors(blood_group, rh_factor)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donors_status ON blood_donors(donor_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donors_phone ON blood_donors(phone)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donations_donor ON blood_donations(donor_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donations_date ON blood_donations(donation_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donations_status ON blood_donations(donation_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_donations_bag ON blood_donations(bag_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_inventory_component ON blood_inventory(component_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_inventory_group ON blood_inventory(blood_group, rh_factor)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_inventory_status ON blood_inventory(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_blood_inventory_expiry ON blood_inventory(expiry_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cross_match_patient ON blood_cross_match(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cross_match_inventory ON blood_cross_match(inventory_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cross_match_result ON blood_cross_match(cross_match_result)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transfusion_patient ON blood_transfusions(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transfusion_inventory ON blood_transfusions(inventory_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transfusion_status ON blood_transfusions(transfusion_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transfusion_start_time ON blood_transfusions(start_time)`);

    // Comments
    statements.push(`COMMENT ON TABLE blood_donors IS 'Blood donor registry with screening and deferral tracking'`);
    statements.push(`COMMENT ON TABLE blood_donations IS 'Individual blood donation events with testing results'`);
    statements.push(`COMMENT ON TABLE blood_inventory IS 'Blood component inventory with expiry tracking'`);
    statements.push(`COMMENT ON TABLE blood_cross_match IS 'Cross-matching for transfusion compatibility (valid 72 hours)'`);
    statements.push(`COMMENT ON TABLE blood_transfusions IS 'Complete transfusion documentation with reaction monitoring'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 30: Infection Control
  // =====================================================================================================================
  private getSprint30InfectionControlSchemaStatements(): string[] {
    const statements: string[] = [];

    // Infection Surveillance
    statements.push(`
      CREATE TABLE IF NOT EXISTS infection_surveillance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        infection_type VARCHAR(100) NOT NULL CHECK (infection_type IN ('CAUTI', 'CLABSI', 'SSI', 'VAP', 'CDI', 'MRSA', 'VRE', 'CRE', 'Other')),
        infection_site VARCHAR(100),
        infection_date DATE NOT NULL,
        onset_type VARCHAR(50) CHECK (onset_type IN ('community_acquired', 'hospital_acquired', 'healthcare_associated')),
        days_since_admission INTEGER,
        organism VARCHAR(255),
        culture_source VARCHAR(100),
        culture_date DATE,
        antibiotic_resistance JSONB DEFAULT '[]'::jsonb,
        risk_factors JSONB DEFAULT '[]'::jsonb,
        device_associated BOOLEAN DEFAULT false,
        device_type VARCHAR(100),
        infection_icd10 VARCHAR(10),
        severity VARCHAR(50) CHECK (severity IN ('mild', 'moderate', 'severe', 'sepsis', 'septic_shock')),
        resolved BOOLEAN DEFAULT false,
        resolution_date DATE,
        outcome VARCHAR(50) CHECK (outcome IN ('resolved', 'ongoing', 'transferred', 'deceased')),
        reported_to_cdc BOOLEAN DEFAULT false,
        reported_date DATE,
        investigated BOOLEAN DEFAULT false,
        investigation_notes TEXT,
        root_cause TEXT,
        detected_by UUID REFERENCES users(id),
        detected_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Isolation Precautions
    statements.push(`
      CREATE TABLE IF NOT EXISTS isolation_precautions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        isolation_type VARCHAR(50) NOT NULL CHECK (isolation_type IN ('standard', 'contact', 'droplet', 'airborne', 'contact_plus', 'protective')),
        reason TEXT NOT NULL,
        organism VARCHAR(255),
        infection_icd10 VARCHAR(10),
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_date TIMESTAMP WITH TIME ZONE,
        room_number VARCHAR(50),
        bed_number VARCHAR(50),
        ppe_required JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'transferred')),
        ordered_by UUID NOT NULL REFERENCES users(id),
        discontinued_by UUID REFERENCES users(id),
        discontinuation_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Antimicrobial Stewardship
    statements.push(`
      CREATE TABLE IF NOT EXISTS antimicrobial_stewardship (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        prescription_id UUID REFERENCES prescriptions(id),
        antibiotic_name VARCHAR(255) NOT NULL,
        antibiotic_class VARCHAR(100),
        dose VARCHAR(100),
        route VARCHAR(50),
        frequency VARCHAR(100),
        indication TEXT NOT NULL,
        indication_icd10 VARCHAR(10),
        empiric_or_targeted VARCHAR(50) CHECK (empiric_or_targeted IN ('empiric', 'targeted', 'prophylactic')),
        culture_sent BOOLEAN DEFAULT false,
        culture_source VARCHAR(100),
        culture_result TEXT,
        organism_identified VARCHAR(255),
        sensitivity_profile JSONB,
        start_date DATE NOT NULL,
        planned_duration_days INTEGER,
        actual_stop_date DATE,
        total_days_given INTEGER,
        review_required BOOLEAN DEFAULT false,
        review_date DATE,
        reviewed_by UUID REFERENCES users(id),
        stewardship_recommendation TEXT,
        recommendation_followed BOOLEAN,
        appropriate_indication BOOLEAN,
        appropriate_dose BOOLEAN,
        appropriate_duration BOOLEAN,
        de_escalation_opportunity BOOLEAN DEFAULT false,
        de_escalation_notes TEXT,
        prescribed_by UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Outbreak Alerts
    statements.push(`
      CREATE TABLE IF NOT EXISTS outbreak_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        outbreak_name VARCHAR(255) NOT NULL,
        organism VARCHAR(255),
        infection_type VARCHAR(100),
        detection_date DATE NOT NULL,
        detection_method VARCHAR(100),
        ward_location VARCHAR(100),
        affected_patient_count INTEGER DEFAULT 0,
        staff_affected_count INTEGER DEFAULT 0,
        alert_level VARCHAR(50) CHECK (alert_level IN ('watch', 'alert', 'outbreak', 'resolved')),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'contained', 'resolved')),
        investigation_started BOOLEAN DEFAULT false,
        investigation_lead UUID REFERENCES users(id),
        root_cause TEXT,
        interventions_implemented JSONB DEFAULT '[]'::jsonb,
        resolved_date DATE,
        lessons_learned TEXT,
        reported_to_health_department BOOLEAN DEFAULT false,
        report_date DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Hand Hygiene Compliance
    statements.push(`
      CREATE TABLE IF NOT EXISTS hand_hygiene_compliance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        observation_date DATE NOT NULL,
        observation_time TIME NOT NULL,
        location VARCHAR(100) NOT NULL,
        staff_id UUID REFERENCES users(id),
        staff_role VARCHAR(50),
        opportunity_type VARCHAR(50) CHECK (opportunity_type IN ('before_patient_contact', 'before_aseptic_procedure', 'after_body_fluid_exposure', 'after_patient_contact', 'after_patient_surroundings')),
        hand_hygiene_performed BOOLEAN NOT NULL,
        method_used VARCHAR(50) CHECK (method_used IN ('soap_and_water', 'alcohol_rub', 'none')),
        observed_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_infection_patient ON infection_surveillance(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_infection_type ON infection_surveillance(infection_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_infection_date ON infection_surveillance(infection_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_infection_onset ON infection_surveillance(onset_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_isolation_patient ON isolation_precautions(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_isolation_type ON isolation_precautions(isolation_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_isolation_status ON isolation_precautions(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_antimicrobial_patient ON antimicrobial_stewardship(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_antimicrobial_antibiotic ON antimicrobial_stewardship(antibiotic_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_antimicrobial_start_date ON antimicrobial_stewardship(start_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_outbreak_date ON outbreak_alerts(detection_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_outbreak_status ON outbreak_alerts(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_outbreak_level ON outbreak_alerts(alert_level)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hand_hygiene_date ON hand_hygiene_compliance(observation_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hand_hygiene_staff ON hand_hygiene_compliance(staff_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hand_hygiene_compliance ON hand_hygiene_compliance(hand_hygiene_performed)`);

    // Comments
    statements.push(`COMMENT ON TABLE infection_surveillance IS 'Hospital-acquired infection tracking and surveillance'`);
    statements.push(`COMMENT ON TABLE isolation_precautions IS 'Isolation tracking for infectious patients with PPE requirements'`);
    statements.push(`COMMENT ON TABLE antimicrobial_stewardship IS 'Antibiotic usage tracking and stewardship program'`);
    statements.push(`COMMENT ON TABLE outbreak_alerts IS 'Outbreak detection and management'`);
    statements.push(`COMMENT ON TABLE hand_hygiene_compliance IS 'Hand hygiene monitoring and compliance tracking (WHO 5 Moments)'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 32: Clinical Documentation Improvement (CDI)
  // =====================================================================================================================
  private getSprint32CDISchemaStatements(): string[] {
    const statements: string[] = [];

    // CDI Reviews
    statements.push(`
      CREATE TABLE IF NOT EXISTS cdi_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        review_date DATE DEFAULT CURRENT_DATE,
        review_type VARCHAR(50) CHECK (review_type IN ('concurrent', 'retrospective', 'post_discharge')),
        current_drg VARCHAR(10),
        current_drg_weight DECIMAL(6, 4),
        potential_drg VARCHAR(10),
        potential_drg_weight DECIMAL(6, 4),
        potential_impact DECIMAL(10, 2),
        documentation_issues JSONB DEFAULT '[]'::jsonb,
        severity_of_illness VARCHAR(20) CHECK (severity_of_illness IN ('minor', 'moderate', 'major', 'extreme')),
        risk_of_mortality VARCHAR(20) CHECK (risk_of_mortality IN ('minor', 'moderate', 'major', 'extreme')),
        cc_mcc_opportunities JSONB DEFAULT '[]'::jsonb,
        query_needed BOOLEAN DEFAULT false,
        query_reason TEXT,
        reviewed_by UUID NOT NULL REFERENCES users(id),
        review_status VARCHAR(50) DEFAULT 'in_progress' CHECK (review_status IN ('in_progress', 'query_sent', 'query_answered', 'completed', 'no_action_needed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Physician Queries
    statements.push(`
      CREATE TABLE IF NOT EXISTS physician_queries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_number VARCHAR(50) UNIQUE NOT NULL,
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        cdi_review_id UUID REFERENCES cdi_reviews(id),
        query_type VARCHAR(50) CHECK (query_type IN ('clinical_clarification', 'documentation_improvement', 'coding_question', 'conflicting_documentation')),
        query_text TEXT NOT NULL,
        clinical_indicators TEXT,
        physician_id UUID NOT NULL REFERENCES users(id),
        query_date DATE DEFAULT CURRENT_DATE,
        priority VARCHAR(20) CHECK (priority IN ('routine', 'urgent', 'stat')),
        due_date DATE,
        potential_drg_change VARCHAR(10),
        financial_impact DECIMAL(10, 2),
        response_text TEXT,
        response_date DATE,
        response_action VARCHAR(50) CHECK (response_action IN ('documented', 'not_clinically_present', 'unable_to_determine', 'no_response')),
        query_status VARCHAR(50) DEFAULT 'sent' CHECK (query_status IN ('draft', 'sent', 'answered', 'closed', 'escalated')),
        documentation_improved BOOLEAN DEFAULT false,
        drg_changed BOOLEAN DEFAULT false,
        created_by UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Documentation Completeness
    statements.push(`
      CREATE TABLE IF NOT EXISTS documentation_completeness (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        history_physical_score INTEGER CHECK (history_physical_score BETWEEN 0 AND 100),
        progress_notes_score INTEGER CHECK (progress_notes_score BETWEEN 0 AND 100),
        discharge_summary_score INTEGER CHECK (discharge_summary_score BETWEEN 0 AND 100),
        procedure_notes_score INTEGER CHECK (procedure_notes_score BETWEEN 0 AND 100),
        overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
        missing_elements JSONB DEFAULT '[]'::jsonb,
        principal_diagnosis_documented BOOLEAN DEFAULT false,
        secondary_diagnoses_count INTEGER DEFAULT 0,
        procedures_documented_count INTEGER DEFAULT 0,
        poa_indicators_complete BOOLEAN DEFAULT false,
        discharge_disposition VARCHAR(100),
        discharge_summary_complete BOOLEAN DEFAULT false,
        discharge_summary_date DATE,
        compliant_with_cms BOOLEAN DEFAULT false,
        compliance_issues JSONB DEFAULT '[]'::jsonb,
        last_checked_date DATE DEFAULT CURRENT_DATE,
        checked_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // CDI Opportunities
    statements.push(`
      CREATE TABLE IF NOT EXISTS cdi_opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        opportunity_type VARCHAR(100) CHECK (opportunity_type IN ('cc_mcc', 'soi_rom', 'poa_indicator', 'principal_diagnosis', 'secondary_diagnosis', 'procedure_documentation')),
        opportunity_description TEXT NOT NULL,
        supporting_data JSONB,
        icd10_code_suggested VARCHAR(10),
        estimated_impact DECIMAL(10, 2),
        impact_type VARCHAR(50) CHECK (impact_type IN ('drg_change', 'case_mix_index', 'severity_adjustment', 'documentation_quality')),
        status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'query_sent', 'documented', 'declined', 'not_applicable')),
        detected_by VARCHAR(50) DEFAULT 'system' CHECK (detected_by IN ('system', 'cdi_specialist', 'coder')),
        detected_date DATE DEFAULT CURRENT_DATE,
        resolved_date DATE,
        resolution_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_reviews_admission ON cdi_reviews(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_reviews_patient ON cdi_reviews(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_reviews_status ON cdi_reviews(review_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_reviews_date ON cdi_reviews(review_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_physician_queries_admission ON physician_queries(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_physician_queries_physician ON physician_queries(physician_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_physician_queries_status ON physician_queries(query_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_physician_queries_date ON physician_queries(query_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doc_completeness_admission ON documentation_completeness(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doc_completeness_patient ON documentation_completeness(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_doc_completeness_score ON documentation_completeness(overall_score)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_admission ON cdi_opportunities(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_status ON cdi_opportunities(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_type ON cdi_opportunities(opportunity_type)`);

    // Comments
    statements.push(`COMMENT ON TABLE cdi_reviews IS 'CDI specialist reviews with DRG impact analysis'`);
    statements.push(`COMMENT ON TABLE physician_queries IS 'Queries sent to physicians for documentation clarification'`);
    statements.push(`COMMENT ON TABLE documentation_completeness IS 'Documentation completeness tracking for CMS compliance'`);
    statements.push(`COMMENT ON TABLE cdi_opportunities IS 'Potential documentation improvement opportunities with financial impact'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 33: Case Management & Discharge Planning
  // =====================================================================================================================
  private getSprint33CaseManagementSchemaStatements(): string[] {
    const statements: string[] = [];

    // Case Management Assessments
    statements.push(`
      CREATE TABLE IF NOT EXISTS case_management_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        assessment_date DATE DEFAULT CURRENT_DATE,
        assessment_type VARCHAR(50) CHECK (assessment_type IN ('initial', 'ongoing', 'discharge', 'post_discharge')),
        medical_complexity VARCHAR(50) CHECK (medical_complexity IN ('low', 'moderate', 'high', 'very_high')),
        functional_status VARCHAR(50),
        cognitive_status VARCHAR(50),
        psychosocial_needs TEXT,
        discharge_barriers JSONB DEFAULT '[]'::jsonb,
        home_health_needed BOOLEAN DEFAULT false,
        dme_needed BOOLEAN DEFAULT false,
        skilled_nursing_facility BOOLEAN DEFAULT false,
        rehabilitation_needed BOOLEAN DEFAULT false,
        housing_status VARCHAR(100),
        support_system VARCHAR(100),
        financial_concerns BOOLEAN DEFAULT false,
        insurance_issues BOOLEAN DEFAULT false,
        readmission_risk VARCHAR(50) CHECK (readmission_risk IN ('low', 'moderate', 'high')),
        risk_factors JSONB DEFAULT '[]'::jsonb,
        case_manager_id UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Discharge Plans
    statements.push(`
      CREATE TABLE IF NOT EXISTS discharge_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        target_discharge_date DATE,
        actual_discharge_date DATE,
        discharge_disposition VARCHAR(100) CHECK (discharge_disposition IN ('home', 'home_with_services', 'skilled_nursing_facility', 'rehab', 'hospice', 'ama', 'deceased', 'transferred')),
        discharge_instructions TEXT,
        medication_reconciliation_complete BOOLEAN DEFAULT false,
        follow_up_appointments JSONB DEFAULT '[]'::jsonb,
        dme_orders JSONB DEFAULT '[]'::jsonb,
        home_health_orders JSONB DEFAULT '[]'::jsonb,
        prescriptions_sent BOOLEAN DEFAULT false,
        transportation_arranged BOOLEAN DEFAULT false,
        transportation_type VARCHAR(100),
        patient_education_completed BOOLEAN DEFAULT false,
        education_topics JSONB DEFAULT '[]'::jsonb,
        education_materials_provided JSONB DEFAULT '[]'::jsonb,
        barriers_resolved BOOLEAN DEFAULT false,
        remaining_barriers TEXT,
        readmission_prevention_plan TEXT,
        high_risk_follow_up BOOLEAN DEFAULT false,
        physician_approval BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES users(id),
        approval_date DATE,
        case_manager_id UUID REFERENCES users(id),
        plan_status VARCHAR(50) DEFAULT 'planning' CHECK (plan_status IN ('planning', 'ready', 'executed', 'delayed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Utilization Reviews
    statements.push(`
      CREATE TABLE IF NOT EXISTS utilization_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES admissions(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        review_date DATE DEFAULT CURRENT_DATE,
        review_type VARCHAR(50) CHECK (review_type IN ('admission', 'continued_stay', 'discharge')),
        medical_necessity_met BOOLEAN,
        necessity_criteria TEXT,
        current_level_of_care VARCHAR(100),
        appropriate_level_of_care BOOLEAN,
        recommended_level VARCHAR(100),
        current_los INTEGER,
        expected_los INTEGER,
        los_variance INTEGER GENERATED ALWAYS AS (current_los - expected_los) STORED,
        recommendations TEXT,
        discharge_plan_in_place BOOLEAN DEFAULT false,
        next_review_date DATE,
        reviewed_by UUID NOT NULL REFERENCES users(id),
        review_status VARCHAR(50) DEFAULT 'approved' CHECK (review_status IN ('approved', 'denied', 'pending', 'appeal')),
        denial_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_case_mgmt_admission ON case_management_assessments(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_case_mgmt_patient ON case_management_assessments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_case_mgmt_manager ON case_management_assessments(case_manager_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_discharge_plans_admission ON discharge_plans(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_discharge_plans_patient ON discharge_plans(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_discharge_plans_target_date ON discharge_plans(target_discharge_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_util_review_admission ON utilization_reviews(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_util_review_patient ON utilization_reviews(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_util_review_date ON utilization_reviews(review_date)`);

    // Comments
    statements.push(`COMMENT ON TABLE case_management_assessments IS 'Case management assessments with social determinants and discharge barriers'`);
    statements.push(`COMMENT ON TABLE discharge_plans IS 'Comprehensive discharge planning with medication reconciliation and follow-up'`);
    statements.push(`COMMENT ON TABLE utilization_reviews IS 'Utilization management and continued stay reviews for medical necessity'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 34: Dietary & Nutrition
  // =====================================================================================================================
  private getSprint34DietarySchemaStatements(): string[] {
    const statements: string[] = [];

    // Diet Orders
    statements.push(`
      CREATE TABLE IF NOT EXISTS diet_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        diet_type VARCHAR(100) NOT NULL CHECK (diet_type IN ('regular', 'NPO', 'clear_liquid', 'full_liquid', 'soft', 'diabetic', 'cardiac', 'renal', 'low_sodium', 'low_fat', 'gluten_free', 'pureed', 'mechanical_soft')),
        diet_texture VARCHAR(50) CHECK (diet_texture IN ('regular', 'chopped', 'minced', 'pureed')),
        food_allergies JSONB DEFAULT '[]'::jsonb,
        food_restrictions JSONB DEFAULT '[]'::jsonb,
        nutritional_supplements JSONB DEFAULT '[]'::jsonb,
        tube_feeding BOOLEAN DEFAULT false,
        tube_feeding_formula VARCHAR(255),
        tube_feeding_rate VARCHAR(100),
        tpn_ordered BOOLEAN DEFAULT false,
        tpn_formula TEXT,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE,
        ordered_by UUID NOT NULL REFERENCES users(id),
        order_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Nutritional Assessments
    statements.push(`
      CREATE TABLE IF NOT EXISTS nutritional_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        assessment_date DATE DEFAULT CURRENT_DATE,
        height_cm DECIMAL(5, 2),
        weight_kg DECIMAL(5, 2),
        bmi DECIMAL(4, 2) GENERATED ALWAYS AS (weight_kg / ((height_cm / 100) * (height_cm / 100))) STORED,
        nutritional_risk VARCHAR(50) CHECK (nutritional_risk IN ('low', 'moderate', 'high')),
        malnutrition_diagnosis VARCHAR(100),
        oral_intake_percentage INTEGER CHECK (oral_intake_percentage BETWEEN 0 AND 100),
        swallowing_difficulty BOOLEAN DEFAULT false,
        albumin DECIMAL(3, 2),
        prealbumin DECIMAL(4, 2),
        dietary_recommendations TEXT,
        calorie_needs INTEGER,
        protein_needs INTEGER,
        assessed_by UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_diet_orders_patient ON diet_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_diet_orders_admission ON diet_orders(admission_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_diet_orders_status ON diet_orders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_nutrition_assessment_patient ON nutritional_assessments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_nutrition_assessment_date ON nutritional_assessments(assessment_date)`);

    // Comments
    statements.push(`COMMENT ON TABLE diet_orders IS 'Diet orders for inpatients with allergies and restrictions'`);
    statements.push(`COMMENT ON TABLE nutritional_assessments IS 'Nutritional assessments by dietitians with malnutrition screening'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 35: Respiratory Therapy
  // =====================================================================================================================
  private getSprint35RespiratorySchemaStatements(): string[] {
    const statements: string[] = [];

    // Respiratory Orders
    statements.push(`
      CREATE TABLE IF NOT EXISTS respiratory_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        order_type VARCHAR(100) NOT NULL CHECK (order_type IN ('oxygen', 'nebulizer', 'ventilator', 'cpap', 'bipap', 'chest_pt')),
        oxygen_flow_rate VARCHAR(50),
        fio2 DECIMAL(3, 2),
        ordered_by UUID NOT NULL REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_resp_orders_patient ON respiratory_orders(patient_id)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 36: Physical Therapy
  // =====================================================================================================================
  private getSprint36PhysicalTherapySchemaStatements(): string[] {
    const statements: string[] = [];

    // Therapy Orders
    statements.push(`
      CREATE TABLE IF NOT EXISTS therapy_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        therapy_type VARCHAR(50) CHECK (therapy_type IN ('PT', 'OT', 'speech')),
        frequency VARCHAR(100),
        ordered_by UUID NOT NULL REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_therapy_orders_patient ON therapy_orders(patient_id)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 37: Supply Chain Management
  // =====================================================================================================================
  private getSprint37SupplyChainSchemaStatements(): string[] {
    const statements: string[] = [];

    // Supply Inventory
    statements.push(`
      CREATE TABLE IF NOT EXISTS supply_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_name VARCHAR(255) NOT NULL,
        item_code VARCHAR(50) UNIQUE NOT NULL,
        category VARCHAR(100),
        quantity INTEGER DEFAULT 0,
        par_level INTEGER DEFAULT 10,
        unit_cost DECIMAL(10, 2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_supply_inventory_code ON supply_inventory(item_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_supply_inventory_category ON supply_inventory(category)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 38: Sepsis Management
  // =====================================================================================================================
  private getSprint38SepsisSchemaStatements(): string[] {
    const statements: string[] = [];

    // Sepsis Screenings
    statements.push(`
      CREATE TABLE IF NOT EXISTS sepsis_screenings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        screening_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        screening_location VARCHAR(100),
        qsofa_altered_mental_status BOOLEAN DEFAULT false,
        qsofa_systolic_bp_low BOOLEAN DEFAULT false,
        qsofa_respiratory_rate_high BOOLEAN DEFAULT false,
        qsofa_score INTEGER CHECK (qsofa_score BETWEEN 0 AND 3),
        sirs_temp_abnormal BOOLEAN DEFAULT false,
        sirs_heart_rate_high BOOLEAN DEFAULT false,
        sirs_respiratory_rate_high BOOLEAN DEFAULT false,
        sirs_wbc_abnormal BOOLEAN DEFAULT false,
        sirs_score INTEGER CHECK (sirs_score BETWEEN 0 AND 4),
        temperature DECIMAL(4, 2),
        heart_rate INTEGER,
        respiratory_rate INTEGER,
        systolic_bp INTEGER,
        oxygen_saturation INTEGER,
        wbc_count DECIMAL(5, 2),
        lactate DECIMAL(4, 2),
        sepsis_suspected BOOLEAN DEFAULT false,
        severe_sepsis BOOLEAN DEFAULT false,
        septic_shock BOOLEAN DEFAULT false,
        sepsis_alert_triggered BOOLEAN DEFAULT false,
        sepsis_bundle_initiated BOOLEAN DEFAULT false,
        screened_by UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Sepsis Bundles
    statements.push(`
      CREATE TABLE IF NOT EXISTS sepsis_bundles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        sepsis_screening_id UUID REFERENCES sepsis_screenings(id),
        bundle_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        lactate_measured BOOLEAN DEFAULT false,
        lactate_measurement_time TIMESTAMP WITH TIME ZONE,
        lactate_value DECIMAL(4, 2),
        blood_cultures_drawn BOOLEAN DEFAULT false,
        blood_cultures_time TIMESTAMP WITH TIME ZONE,
        broad_spectrum_antibiotics_given BOOLEAN DEFAULT false,
        antibiotics_time TIMESTAMP WITH TIME ZONE,
        antibiotic_name VARCHAR(255),
        fluid_bolus_given BOOLEAN DEFAULT false,
        fluid_bolus_time TIMESTAMP WITH TIME ZONE,
        fluid_volume_ml INTEGER,
        vasopressors_initiated BOOLEAN DEFAULT false,
        vasopressors_time TIMESTAMP WITH TIME ZONE,
        vasopressor_name VARCHAR(255),
        repeat_lactate_measured BOOLEAN DEFAULT false,
        repeat_lactate_time TIMESTAMP WITH TIME ZONE,
        repeat_lactate_value DECIMAL(4, 2),
        three_hour_bundle_complete BOOLEAN DEFAULT false,
        three_hour_compliance_time TIMESTAMP WITH TIME ZONE,
        six_hour_bundle_complete BOOLEAN DEFAULT false,
        six_hour_compliance_time TIMESTAMP WITH TIME ZONE,
        overall_compliance BOOLEAN DEFAULT false,
        patient_outcome VARCHAR(50) CHECK (patient_outcome IN ('improved', 'stable', 'deteriorated', 'deceased', 'transferred')),
        outcome_date DATE,
        managed_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_screening_patient ON sepsis_screenings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_screening_datetime ON sepsis_screenings(screening_datetime)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_screening_suspected ON sepsis_screenings(sepsis_suspected)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_patient ON sepsis_bundles(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_start ON sepsis_bundles(bundle_start_time)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_compliance ON sepsis_bundles(overall_compliance)`);

    // Comments
    statements.push(`COMMENT ON TABLE sepsis_screenings IS 'Sepsis screening using qSOFA and SIRS criteria'`);
    statements.push(`COMMENT ON TABLE sepsis_bundles IS 'SEP-1 bundle tracking for CMS core measure compliance'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 39: Advanced Nursing
  // =====================================================================================================================
  private getSprint39AdvancedNursingSchemaStatements(): string[] {
    const statements: string[] = [];

    // Falls Risk Assessments
    statements.push(`
      CREATE TABLE IF NOT EXISTS falls_risk_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        assessment_date DATE DEFAULT CURRENT_DATE,
        morse_falls_score INTEGER CHECK (morse_falls_score BETWEEN 0 AND 125),
        risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'moderate', 'high')),
        interventions JSONB DEFAULT '[]'::jsonb,
        assessed_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Wound Assessments
    statements.push(`
      CREATE TABLE IF NOT EXISTS wound_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id),
        admission_id UUID REFERENCES admissions(id),
        wound_location VARCHAR(255) NOT NULL,
        wound_type VARCHAR(100) CHECK (wound_type IN ('pressure_injury', 'surgical', 'traumatic', 'diabetic', 'venous', 'arterial')),
        stage VARCHAR(50),
        length_cm DECIMAL(5, 2),
        width_cm DECIMAL(5, 2),
        depth_cm DECIMAL(5, 2),
        braden_score INTEGER CHECK (braden_score BETWEEN 6 AND 23),
        treatment_plan TEXT,
        assessed_by UUID NOT NULL REFERENCES users(id),
        assessment_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_falls_risk_patient ON falls_risk_assessments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_wound_patient ON wound_assessments(patient_id)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 40: Patient Safety Reporting
  // =====================================================================================================================
  private getSprint40PatientSafetySchemaStatements(): string[] {
    const statements: string[] = [];

    // Safety Incidents
    statements.push(`
      CREATE TABLE IF NOT EXISTS safety_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_number VARCHAR(50) UNIQUE NOT NULL,
        patient_id UUID REFERENCES patients(id),
        incident_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        incident_type VARCHAR(100) CHECK (incident_type IN ('medication_error', 'fall', 'pressure_injury', 'wrong_site', 'device_malfunction', 'other')),
        severity VARCHAR(50) CHECK (severity IN ('minor', 'moderate', 'severe', 'catastrophic')),
        description TEXT NOT NULL,
        harm_occurred BOOLEAN DEFAULT false,
        reported_by UUID NOT NULL REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_safety_incidents_date ON safety_incidents(incident_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_safety_incidents_type ON safety_incidents(incident_type)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 41: Quality Reporting
  // =====================================================================================================================
  private getSprint41QualityReportingSchemaStatements(): string[] {
    const statements: string[] = [];

    // Quality Measures
    statements.push(`
      CREATE TABLE IF NOT EXISTS quality_measures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        measure_code VARCHAR(50) NOT NULL,
        measure_name VARCHAR(255) NOT NULL,
        measure_type VARCHAR(50) CHECK (measure_type IN ('cms_core', 'hedis', 'jci', 'custom')),
        numerator_criteria TEXT,
        denominator_criteria TEXT,
        target_percentage DECIMAL(5, 2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Quality Measure Results
    statements.push(`
      CREATE TABLE IF NOT EXISTS quality_measure_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        measure_id UUID NOT NULL REFERENCES quality_measures(id),
        reporting_period_start DATE NOT NULL,
        reporting_period_end DATE NOT NULL,
        numerator_count INTEGER DEFAULT 0,
        denominator_count INTEGER DEFAULT 0,
        compliance_percentage DECIMAL(5, 2) GENERATED ALWAYS AS ((numerator_count::decimal / NULLIF(denominator_count, 0)) * 100) STORED,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_quality_results_measure ON quality_measure_results(measure_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_quality_results_period ON quality_measure_results(reporting_period_start, reporting_period_end)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 42: Advanced Analytics
  // =====================================================================================================================
  private getSprint42AdvancedAnalyticsSchemaStatements(): string[] {
    const statements: string[] = [];

    // Analytics Reports
    statements.push(`
      CREATE TABLE IF NOT EXISTS analytics_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_name VARCHAR(255) NOT NULL,
        report_type VARCHAR(100) CHECK (report_type IN ('operational', 'financial', 'clinical', 'quality')),
        report_query TEXT NOT NULL,
        parameters JSONB DEFAULT '{}'::jsonb,
        schedule VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Executive Metrics
    statements.push(`
      CREATE TABLE IF NOT EXISTS executive_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_date DATE DEFAULT CURRENT_DATE,
        total_admissions INTEGER DEFAULT 0,
        total_discharges INTEGER DEFAULT 0,
        average_los DECIMAL(5, 2),
        bed_occupancy_rate DECIMAL(5, 2),
        total_surgeries INTEGER DEFAULT 0,
        total_ed_visits INTEGER DEFAULT 0,
        total_revenue DECIMAL(12, 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Indexes
    statements.push(`CREATE INDEX IF NOT EXISTS idx_exec_metrics_date ON executive_metrics(metric_date)`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 45: Drug Database Enhancement (RxNorm, SNOMED, NDC, Strength, Unit, Status)
  // =====================================================================================================================
  private getSprint45DrugEnhancementSchemaStatements(): string[] {
    const statements: string[] = [];

    // Add RxNorm fields (if not already present)
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_code VARCHAR(20)`);
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_name TEXT`);
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_tty VARCHAR(20)`);

    // Add SNOMED CT fields
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_code VARCHAR(50)`);
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_term TEXT`);

    // Add NDC (National Drug Code) field
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS ndc_code VARCHAR(50)`);

    // Add strength and unit fields
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS strength VARCHAR(100)`);
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);

    // Add status field (FHIR standard: active, inactive, entered-in-error)
    statements.push(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);

    // Update existing rxnorm_code column size if it exists (from VARCHAR(50) to VARCHAR(20))
    statements.push(`DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drugs' AND column_name = 'rxnorm_code' 
                   AND character_maximum_length > 20) THEN
          ALTER TABLE drugs ALTER COLUMN rxnorm_code TYPE VARCHAR(20);
        END IF;
      END $$`);

    // Create indexes for faster lookups
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_status ON drugs(status)`);

    // Add comments for documentation
    statements.push(`COMMENT ON COLUMN drugs.rxnorm_code IS 'RxNorm Concept Unique Identifier (RXCUI)'`);
    statements.push(`COMMENT ON COLUMN drugs.rxnorm_name IS 'RxNorm preferred name or normalized drug name'`);
    statements.push(`COMMENT ON COLUMN drugs.rxnorm_tty IS 'RxNorm Term Type (SCD=Semantic Clinical Drug, SCDC=Semantic Clinical Drug Component)'`);
    statements.push(`COMMENT ON COLUMN drugs.snomed_code IS 'SNOMED CT concept code for medication'`);
    statements.push(`COMMENT ON COLUMN drugs.snomed_term IS 'SNOMED CT preferred term'`);
    statements.push(`COMMENT ON COLUMN drugs.ndc_code IS 'National Drug Code (US FDA)'`);
    statements.push(`COMMENT ON COLUMN drugs.strength IS 'Drug strength (e.g., "500", "10mg")'`);
    statements.push(`COMMENT ON COLUMN drugs.unit IS 'Unit of measurement (e.g., "mg", "ml", "tablet")'`);
    statements.push(`COMMENT ON COLUMN drugs.status IS 'FHIR Medication status: active, inactive, entered-in-error'`);

    return statements;
  }

  // =====================================================================================================================
  // Sprint 45: Pharmacy Dispensing Enhancement
  // =====================================================================================================================
  /*private getWhoSmartFormsDataSchemaStatements(): string[] {
    return [
      `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_tests_who_smart_form_data ON hiv_tests USING GIN(who_smart_form_data)`,
      `ALTER TABLE hiv_care_enrollments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_who_smart_form_data ON hiv_care_enrollments USING GIN(who_smart_form_data)`,
      `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_hiv_clinical_visits_who_smart_form_data ON hiv_clinical_visits USING GIN(who_smart_form_data)`,
      `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_tb_screenings_who_smart_form_data ON tb_screenings USING GIN(who_smart_form_data)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_who_smart_form_data ON appointments USING GIN(who_smart_form_data)`,
      `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_who_smart_form_data ON medical_records USING GIN(who_smart_form_data)`,
    ];
  }
  */

  private getSprint45PharmacyDispensingEnhancementSchemaStatements(): string[] {
    const statements: string[] = [];

    // Add dispensing_number column (unique identifier for dispensing)
    statements.push(`ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS dispensing_number VARCHAR(50) UNIQUE`);

    // Add total_amount column (total cost of dispensing)
    statements.push(`ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0`);

    // Add amount_paid column (amount paid by patient)
    statements.push(`ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0`);

    // Add discount_amount column (discount applied)
    statements.push(`ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0`);

    // Create index on dispensing_number for faster lookups
    statements.push(`CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_dispensing_number ON pharmacy_dispensings(dispensing_number)`);

    // Add comments
    statements.push(`COMMENT ON COLUMN pharmacy_dispensings.dispensing_number IS 'Unique dispensing number/identifier'`);
    statements.push(`COMMENT ON COLUMN pharmacy_dispensings.total_amount IS 'Total amount for the dispensing'`);
    statements.push(`COMMENT ON COLUMN pharmacy_dispensings.amount_paid IS 'Amount paid by patient'`);
    statements.push(`COMMENT ON COLUMN pharmacy_dispensings.discount_amount IS 'Discount amount applied'`);

    return statements;
  }

  private getSprint59VitalsExtendedStatements(): string[] {
    return [
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS waist_cm NUMERIC(5,1)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS hip_cm NUMERIC(5,1)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS bmi NUMERIC(5,2)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS spo2_percent NUMERIC(5,2)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pain_score SMALLINT`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_left_mm NUMERIC(3,1)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_right_mm NUMERIC(3,1)`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_reaction TEXT`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS glasgow_coma_scale SMALLINT`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_eye SMALLINT`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_verbal SMALLINT`,
      `ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_motor SMALLINT`,
    ];
  }

  private getSprint60PatientExtendedSdohStatements(): string[] {
    return [
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(100)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS race VARCHAR(100)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS disability_status TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS country_of_birth VARCHAR(100)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS religion VARCHAR(100)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS interpreter_required BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation VARCHAR(150)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS education_level VARCHAR(50)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS disability_type VARCHAR(200)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_provider_id UUID`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS smoking_status VARCHAR(20)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS pack_years NUMERIC(5,1)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS alcohol_use VARCHAR(20)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS audit_c_score INTEGER`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS substance_use BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS substance_use_details TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS pregnancy_status VARCHAR(30)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS gestational_age_weeks INTEGER`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS advance_directive_on_file BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS secondary_language TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_number TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_housing TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_food_security TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_transport TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_employment TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_education TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_social_support TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sdoh_screened_at TIMESTAMPTZ`,
    ];
  }

  private getSprint61CdssOutcomeFeedbackStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS cdss_decision_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID,
        encounter_id UUID,
        rule_id TEXT NOT NULL,
        rule_version TEXT,
        input_snapshot JSONB NOT NULL DEFAULT '{}',
        recommendation JSONB NOT NULL DEFAULT '{}',
        confidence NUMERIC(5,4),
        clinician_id UUID,
        action_taken TEXT CHECK (action_taken IN ('accepted','modified','rejected','deferred')),
        action_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_log_patient ON cdss_decision_logs (patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_log_rule ON cdss_decision_logs (rule_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS cdss_outcome_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        decision_log_id UUID REFERENCES cdss_decision_logs(id) ON DELETE SET NULL,
        patient_id UUID,
        outcome_type TEXT,
        outcome_date DATE,
        outcome_value JSONB,
        notes TEXT,
        recorded_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS cdss_model_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id TEXT NOT NULL,
        metric_date DATE NOT NULL,
        total_fired INTEGER DEFAULT 0,
        accepted INTEGER DEFAULT 0,
        rejected INTEGER DEFAULT 0,
        modified INTEGER DEFAULT 0,
        tp INTEGER DEFAULT 0,
        fp INTEGER DEFAULT 0,
        tn INTEGER DEFAULT 0,
        fn INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (rule_id, metric_date)
      )`,
    ];
  }

  private getSprint62ProactiveCareGapsStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS care_gap_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        condition_type TEXT,
        logic JSONB NOT NULL DEFAULT '{}',
        priority TEXT CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS care_gaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        rule_id UUID REFERENCES care_gap_rules(id) ON DELETE SET NULL,
        rule_code TEXT,
        gap_description TEXT,
        due_date DATE,
        status TEXT CHECK (status IN ('open','in_progress','resolved','dismissed')) DEFAULT 'open',
        priority TEXT CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
        assigned_to UUID,
        resolved_at TIMESTAMPTZ,
        resolution_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_care_gaps_patient ON care_gaps (patient_id, status)`,
      `CREATE TABLE IF NOT EXISTS care_gap_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gap_id UUID REFERENCES care_gaps(id) ON DELETE CASCADE,
        action_type TEXT,
        performed_by UUID,
        performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      )`,
    ];
  }

  private getSprint63AmbientAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS ambient_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        provider_id UUID NOT NULL,
        appointment_id UUID,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        status TEXT CHECK (status IN ('recording','processing','completed','failed')) DEFAULT 'recording',
        audio_storage_key TEXT,
        duration_seconds INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ambient_sessions_patient ON ambient_sessions (patient_id, started_at DESC)`,
      `CREATE TABLE IF NOT EXISTS ambient_transcripts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES ambient_sessions(id) ON DELETE CASCADE,
        transcript_text TEXT,
        speaker_labels JSONB DEFAULT '[]',
        confidence NUMERIC(5,4),
        language TEXT DEFAULT 'en',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS ambient_soap_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES ambient_sessions(id) ON DELETE CASCADE,
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        icd10_suggestions JSONB DEFAULT '[]',
        medication_suggestions JSONB DEFAULT '[]',
        clinician_reviewed BOOLEAN DEFAULT FALSE,
        review_edits JSONB DEFAULT '{}',
        finalized_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint64PreChartingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS encounter_precharts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID,
        patient_id UUID NOT NULL,
        provider_id UUID NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        chief_complaint TEXT,
        relevant_history JSONB DEFAULT '[]',
        active_medications JSONB DEFAULT '[]',
        active_allergies JSONB DEFAULT '[]',
        pending_orders JSONB DEFAULT '[]',
        overdue_screenings JSONB DEFAULT '[]',
        risk_flags JSONB DEFAULT '[]',
        suggested_agenda JSONB DEFAULT '[]',
        clinician_reviewed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_precharts_appointment ON encounter_precharts (appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_precharts_patient ON encounter_precharts (patient_id, generated_at DESC)`,
    ];
  }

  private getSprint65SmartInboxStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL,
        message_type TEXT CHECK (message_type IN ('lab_result','imaging','referral','patient_message','task','alert','system')) DEFAULT 'system',
        subject TEXT,
        body TEXT,
        sender_id UUID,
        sender_name TEXT,
        patient_id UUID,
        priority TEXT CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
        is_read BOOLEAN DEFAULT FALSE,
        is_actioned BOOLEAN DEFAULT FALSE,
        actioned_at TIMESTAMPTZ,
        related_entity_type TEXT,
        related_entity_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_provider ON inbox_messages (provider_id, is_read, priority)`,
      `CREATE TABLE IF NOT EXISTS inbox_triage_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID REFERENCES inbox_messages(id) ON DELETE CASCADE,
        ai_priority TEXT,
        ai_category TEXT,
        ai_summary TEXT,
        ai_action_suggestion TEXT,
        confidence NUMERIC(5,4),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint66TbModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS tb_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        registered_by UUID NOT NULL,
        registration_date DATE NOT NULL,
        tb_type TEXT CHECK (tb_type IN ('pulmonary','extrapulmonary','disseminated')),
        site_of_disease TEXT,
        patient_category TEXT CHECK (patient_category IN ('new','relapse','treatment_after_failure','treatment_after_loss_to_follow_up','other')),
        hiv_status TEXT CHECK (hiv_status IN ('positive','negative','unknown')),
        baseline_weight_kg NUMERIC(5,2),
        outcome TEXT,
        outcome_date DATE,
        treatment_end_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_cases_patient ON tb_cases (patient_id, registration_date DESC)`,
      `CREATE TABLE IF NOT EXISTS tb_treatment_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES tb_cases(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL,
        regimen TEXT NOT NULL,
        phase TEXT CHECK (phase IN ('intensive','continuation')),
        start_date DATE NOT NULL,
        end_date DATE,
        dot_adherence_pct NUMERIC(5,2),
        adverse_effects JSONB DEFAULT '[]',
        weight_kg NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS tb_contact_traces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES tb_cases(id) ON DELETE CASCADE,
        contact_name TEXT NOT NULL,
        relationship TEXT,
        contact_date DATE,
        tst_result TEXT,
        igra_result TEXT,
        ltbi_treatment_started BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS tb_sputum_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES tb_cases(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL,
        sample_date DATE NOT NULL,
        test_type TEXT CHECK (test_type IN ('smear','culture','xpert','line_probe')),
        result TEXT CHECK (result IN ('positive','negative','contaminated','pending')),
        bacillary_load TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS tb_drug_susceptibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES tb_cases(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL,
        test_date DATE NOT NULL,
        method TEXT,
        results JSONB NOT NULL DEFAULT '{}',
        xdr_tb BOOLEAN DEFAULT FALSE,
        mdr_tb BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint67PediatricsModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS growth_measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        measured_by UUID NOT NULL,
        measurement_date DATE NOT NULL,
        weight_kg NUMERIC(5,3),
        height_cm NUMERIC(5,1),
        head_circumference_cm NUMERIC(5,1),
        muac_cm NUMERIC(4,1),
        weight_for_age_zscore NUMERIC(5,2),
        height_for_age_zscore NUMERIC(5,2),
        weight_for_height_zscore NUMERIC(5,2),
        bmi_for_age_zscore NUMERIC(5,2),
        nutritional_status TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_growth_patient ON growth_measurements (patient_id, measurement_date DESC)`,
      `CREATE TABLE IF NOT EXISTS developmental_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        age_months SMALLINT,
        gross_motor JSONB DEFAULT '{}',
        fine_motor JSONB DEFAULT '{}',
        language_communication JSONB DEFAULT '{}',
        social_emotional JSONB DEFAULT '{}',
        cognitive JSONB DEFAULT '{}',
        overall_status TEXT CHECK (overall_status IN ('on_track','monitor','delayed','referred')),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS neonatal_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date TIMESTAMPTZ NOT NULL,
        birth_weight_kg NUMERIC(5,3),
        gestational_age_weeks SMALLINT,
        apgar_1min SMALLINT,
        apgar_5min SMALLINT,
        delivery_mode TEXT,
        complications JSONB DEFAULT '[]',
        feeding_method TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS pediatric_consultations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        provider_id UUID NOT NULL,
        consultation_date TIMESTAMPTZ NOT NULL,
        chief_complaint TEXT,
        imci_classification JSONB DEFAULT '[]',
        danger_signs JSONB DEFAULT '[]',
        diagnoses JSONB DEFAULT '[]',
        treatment_plan TEXT,
        follow_up_date DATE,
        referred BOOLEAN DEFAULT FALSE,
        referral_reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ped_consult_patient ON pediatric_consultations (patient_id, consultation_date DESC)`,
    ];
  }

  private getSprint68MentalHealthModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS mental_health_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        clinician_id UUID NOT NULL,
        assessment_date DATE NOT NULL,
        assessment_tool TEXT,
        total_score INTEGER,
        severity TEXT CHECK (severity IN ('none','minimal','mild','moderate','moderately_severe','severe')),
        primary_diagnosis TEXT,
        risk_level TEXT CHECK (risk_level IN ('low','moderate','high','imminent')),
        suicide_risk_score SMALLINT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mh_assess_patient ON mental_health_assessments (patient_id, assessment_date DESC)`,
      `CREATE TABLE IF NOT EXISTS mental_health_treatment_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        clinician_id UUID NOT NULL,
        plan_date DATE NOT NULL,
        diagnosis TEXT,
        goals JSONB DEFAULT '[]',
        interventions JSONB DEFAULT '[]',
        medications JSONB DEFAULT '[]',
        review_date DATE,
        status TEXT CHECK (status IN ('active','completed','discontinued')) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS mental_health_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        clinician_id UUID NOT NULL,
        session_date TIMESTAMPTZ NOT NULL,
        session_type TEXT CHECK (session_type IN ('individual','group','family','crisis','review')),
        duration_minutes SMALLINT,
        progress_notes TEXT,
        risk_assessment TEXT,
        next_session_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS crisis_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        reported_by UUID NOT NULL,
        incident_date TIMESTAMPTZ NOT NULL,
        crisis_type TEXT,
        description TEXT,
        interventions JSONB DEFAULT '[]',
        outcome TEXT,
        follow_up_plan TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS substance_use_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        substances JSONB NOT NULL DEFAULT '[]',
        audit_c_score SMALLINT,
        dast_score SMALLINT,
        treatment_recommended TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint69MalariaModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS malaria_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        diagnosed_by UUID NOT NULL,
        diagnosis_date DATE NOT NULL,
        species TEXT CHECK (species IN ('P_falciparum','P_vivax','P_malariae','P_ovale','P_knowlesi','mixed','unknown')),
        severity TEXT CHECK (severity IN ('uncomplicated','severe','cerebral')),
        parasitaemia_percent NUMERIC(5,2),
        hb_g_dl NUMERIC(4,2),
        outcome TEXT,
        travel_history TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_malaria_patient ON malaria_cases (patient_id, diagnosis_date DESC)`,
      `CREATE TABLE IF NOT EXISTS malaria_rdt_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES malaria_cases(id) ON DELETE SET NULL,
        patient_id UUID NOT NULL,
        test_date TIMESTAMPTZ NOT NULL,
        rdt_brand TEXT,
        pf_result BOOLEAN,
        pv_result BOOLEAN,
        pan_result BOOLEAN,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS malaria_treatments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES malaria_cases(id) ON DELETE SET NULL,
        patient_id UUID NOT NULL,
        regimen TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        weight_kg NUMERIC(5,2),
        artemisinin_doses JSONB DEFAULT '[]',
        iv_artesunate_used BOOLEAN DEFAULT FALSE,
        treatment_outcome TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint70GeriatricsModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS geriatric_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        cga_domains JSONB NOT NULL DEFAULT '{}',
        functional_status TEXT CHECK (functional_status IN ('independent','mild_dependency','moderate_dependency','severe_dependency','total_dependency')),
        adl_score SMALLINT,
        iadl_score SMALLINT,
        barthel_index SMALLINT,
        polypharmacy BOOLEAN DEFAULT FALSE,
        falls_last_year SMALLINT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_geriatric_patient ON geriatric_assessments (patient_id, assessment_date DESC)`,
      `CREATE TABLE IF NOT EXISTS fall_risk_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        tool TEXT CHECK (tool IN ('morse','stratify','hendrich','timed_up_go')),
        total_score SMALLINT,
        risk_level TEXT CHECK (risk_level IN ('low','moderate','high')),
        tug_seconds NUMERIC(5,2),
        interventions JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS cognitive_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        tool TEXT CHECK (tool IN ('mmse','moca','adas_cog','clock_drawing','gds','csid')),
        total_score SMALLINT,
        max_score SMALLINT,
        severity TEXT CHECK (severity IN ('normal','mild_ci','mild_dementia','moderate_dementia','severe_dementia')),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS frailty_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        tool TEXT CHECK (tool IN ('fried','cfs','prisma7')),
        total_score SMALLINT,
        frailty_level TEXT CHECK (frailty_level IN ('robust','pre_frail','frail')),
        components JSONB DEFAULT '{}',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS polypharmacy_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        reviewed_by UUID NOT NULL,
        review_date DATE NOT NULL,
        total_medications SMALLINT,
        potentially_inappropriate JSONB DEFAULT '[]',
        drug_interactions JSONB DEFAULT '[]',
        beers_criteria_flags JSONB DEFAULT '[]',
        stopp_start_flags JSONB DEFAULT '[]',
        deprescribing_recommendations JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint71NeurologyModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS seizure_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_by UUID NOT NULL,
        seizure_date TIMESTAMPTZ NOT NULL,
        seizure_type TEXT,
        duration_seconds INTEGER,
        triggers JSONB DEFAULT '[]',
        postictal_state TEXT,
        current_medications JSONB DEFAULT '[]',
        eeg_finding TEXT,
        mri_finding TEXT,
        status_epilepticus BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_seizure_patient ON seizure_records (patient_id, seizure_date DESC)`,
      `CREATE TABLE IF NOT EXISTS stroke_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        onset_time TIMESTAMPTZ NOT NULL,
        stroke_type TEXT CHECK (stroke_type IN ('ischaemic','haemorrhagic','tia','unknown')),
        nihss_score SMALLINT,
        aspects_score SMALLINT,
        thrombolysis_given BOOLEAN DEFAULT FALSE,
        thrombectomy_given BOOLEAN DEFAULT FALSE,
        door_to_needle_minutes INTEGER,
        outcome TEXT,
        mrs_discharge SMALLINT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS headache_diaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_by UUID NOT NULL,
        headache_date DATE NOT NULL,
        headache_type TEXT CHECK (headache_type IN ('migraine','tension','cluster','secondary','unclassified')),
        severity_nrs SMALLINT CHECK (severity_nrs BETWEEN 0 AND 10),
        duration_hours NUMERIC(5,1),
        triggers JSONB DEFAULT '[]',
        associated_symptoms JSONB DEFAULT '[]',
        medication_used TEXT,
        relief_obtained BOOLEAN,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS cognitive_screenings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        screened_by UUID NOT NULL,
        screening_date DATE NOT NULL,
        tool TEXT CHECK (tool IN ('mmse','moca','ace_iii','slums')),
        total_score SMALLINT,
        max_score SMALLINT,
        domains JSONB DEFAULT '{}',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint72PulmonologyModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS spirometry_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        performed_by UUID NOT NULL,
        test_date DATE NOT NULL,
        fvc_l NUMERIC(5,3),
        fev1_l NUMERIC(5,3),
        fev1_fvc_ratio NUMERIC(5,4),
        fev1_percent_predicted NUMERIC(5,2),
        fvc_percent_predicted NUMERIC(5,2),
        tlc_l NUMERIC(5,3),
        dlco_percent_predicted NUMERIC(5,2),
        reversibility_test BOOLEAN DEFAULT FALSE,
        post_bronchodilator_fev1 NUMERIC(5,3),
        gold_stage TEXT,
        interpretation TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_spirometry_patient ON spirometry_results (patient_id, test_date DESC)`,
      `CREATE TABLE IF NOT EXISTS copd_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        mmrc_dyspnoea SMALLINT CHECK (mmrc_dyspnoea BETWEEN 0 AND 4),
        cat_score SMALLINT,
        gold_group TEXT CHECK (gold_group IN ('A','B','C','D','E')),
        exacerbations_last_year SMALLINT DEFAULT 0,
        hospitalizations_last_year SMALLINT DEFAULT 0,
        current_medications JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS asthma_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        gina_control TEXT CHECK (gina_control IN ('well_controlled','partly_controlled','uncontrolled')),
        gina_step SMALLINT CHECK (gina_step BETWEEN 1 AND 5),
        ace_score SMALLINT,
        reliever_use_week SMALLINT,
        night_waking BOOLEAN DEFAULT FALSE,
        activity_limitation BOOLEAN DEFAULT FALSE,
        current_ics_dose TEXT,
        trigger_factors JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS peak_flow_diaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL,
        pef_l_min NUMERIC(5,1),
        personal_best_l_min NUMERIC(5,1),
        percent_predicted NUMERIC(5,2),
        zone TEXT GENERATED ALWAYS AS (
          CASE
            WHEN percent_predicted >= 80 THEN 'green'
            WHEN percent_predicted >= 50 THEN 'yellow'
            ELSE 'red'
          END
        ) STORED,
        symptoms TEXT,
        reliever_taken BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_peak_flow_patient ON peak_flow_diaries (patient_id, recorded_at DESC)`,
      `CREATE TABLE IF NOT EXISTS oxygen_therapy_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        prescribed_by UUID NOT NULL,
        prescription_date DATE NOT NULL,
        indication TEXT,
        flow_rate_l_min NUMERIC(4,1),
        delivery_device TEXT,
        target_spo2_min NUMERIC(4,1),
        target_spo2_max NUMERIC(4,1),
        hours_per_day SMALLINT,
        is_active BOOLEAN DEFAULT TRUE,
        review_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint73NephrologyModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS ckd_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        egfr_ml_min NUMERIC(6,2),
        egfr_formula TEXT CHECK (egfr_formula IN ('CKD_EPI','MDRD','Cockcroft_Gault')),
        ckd_stage TEXT CHECK (ckd_stage IN ('G1','G2','G3a','G3b','G4','G5','G5D')),
        acr_mg_mmol NUMERIC(7,3),
        acr_category TEXT CHECK (acr_category IN ('A1','A2','A3')),
        kdigo_risk TEXT,
        creatinine_umol NUMERIC(7,2),
        urea_mmol NUMERIC(6,2),
        potassium_mmol NUMERIC(5,2),
        bicarbonate_mmol NUMERIC(5,2),
        phosphate_mmol NUMERIC(5,2),
        haemoglobin_g_dl NUMERIC(4,2),
        bp_systolic SMALLINT,
        bp_diastolic SMALLINT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ckd_patient ON ckd_assessments (patient_id, assessment_date DESC)`,
      `CREATE TABLE IF NOT EXISTS dialysis_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        performed_by UUID NOT NULL,
        session_date TIMESTAMPTZ NOT NULL,
        dialysis_type TEXT CHECK (dialysis_type IN ('HD','HDF','CRRT','PD_CAPD','PD_APD','SLED')),
        access_type TEXT,
        duration_hours NUMERIC(4,2),
        blood_flow_ml_min NUMERIC(5,1),
        dialysate_flow_ml_min NUMERIC(5,1),
        uf_volume_ml NUMERIC(7,1),
        kt_v NUMERIC(5,3),
        urr_percent NUMERIC(5,2),
        pre_weight_kg NUMERIC(5,2),
        post_weight_kg NUMERIC(5,2),
        complications TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS fluid_balance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_by UUID NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL,
        intake_oral_ml NUMERIC(7,1) DEFAULT 0,
        intake_iv_ml NUMERIC(7,1) DEFAULT 0,
        intake_other_ml NUMERIC(7,1) DEFAULT 0,
        output_urine_ml NUMERIC(7,1) DEFAULT 0,
        output_drain_ml NUMERIC(7,1) DEFAULT 0,
        output_other_ml NUMERIC(7,1) DEFAULT 0,
        net_balance_ml NUMERIC(9,1) GENERATED ALWAYS AS (
          (COALESCE(intake_oral_ml,0) + COALESCE(intake_iv_ml,0) + COALESCE(intake_other_ml,0))
          - (COALESCE(output_urine_ml,0) + COALESCE(output_drain_ml,0) + COALESCE(output_other_ml,0))
        ) STORED,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fluid_patient ON fluid_balance_records (patient_id, recorded_at DESC)`,
      `CREATE TABLE IF NOT EXISTS renal_biopsies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        performed_by UUID NOT NULL,
        biopsy_date DATE NOT NULL,
        indication TEXT,
        histopathology_result TEXT,
        immunofluorescence TEXT,
        electron_microscopy TEXT,
        diagnosis TEXT,
        complications TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS transplant_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        transplant_date DATE NOT NULL,
        organ TEXT CHECK (organ IN ('kidney','liver','heart','lung','pancreas','other')),
        donor_type TEXT CHECK (donor_type IN ('living_related','living_unrelated','deceased_dcd','deceased_dbd')),
        hla_mismatch TEXT,
        initial_function TEXT CHECK (initial_function IN ('immediate','delayed','primary_non_function')),
        rejection_episodes JSONB DEFAULT '[]',
        current_immunosuppression JSONB DEFAULT '[]',
        latest_egfr NUMERIC(6,2),
        graft_status TEXT CHECK (graft_status IN ('functioning','failed','returned_to_dialysis')),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint74DermatologyModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS skin_lesions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        documented_by UUID NOT NULL,
        documentation_date DATE NOT NULL,
        location TEXT,
        morphology TEXT,
        size_mm NUMERIC(5,1),
        colour TEXT,
        borders TEXT CHECK (borders IN ('regular','irregular','indistinct')),
        diameter_mm NUMERIC(5,1),
        evolution TEXT,
        dermoscopy_findings TEXT,
        biopsy_result TEXT,
        diagnosis TEXT,
        management_plan TEXT,
        images JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_lesion_patient ON skin_lesions (patient_id, documentation_date DESC)`,
      `CREATE TABLE IF NOT EXISTS wound_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date DATE NOT NULL,
        wound_type TEXT CHECK (wound_type IN ('pressure_ulcer','diabetic_foot','venous_leg_ulcer','arterial_ulcer','surgical','traumatic','other')),
        location TEXT,
        size_length_cm NUMERIC(5,1),
        size_width_cm NUMERIC(5,1),
        depth_cm NUMERIC(4,1),
        stage TEXT,
        bed_tissue JSONB DEFAULT '{}',
        exudate_type TEXT,
        exudate_amount TEXT CHECK (exudate_amount IN ('none','minimal','moderate','heavy')),
        infection_signs BOOLEAN DEFAULT FALSE,
        pain_score SMALLINT,
        dressing_type TEXT,
        next_review DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS burn_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date TIMESTAMPTZ NOT NULL,
        mechanism TEXT CHECK (mechanism IN ('thermal','chemical','electrical','radiation')),
        tbsa_percent NUMERIC(5,2),
        depth_classification TEXT CHECK (depth_classification IN ('superficial','superficial_partial','deep_partial','full_thickness','subdermal')),
        areas_affected JSONB DEFAULT '[]',
        inhalation_injury BOOLEAN DEFAULT FALSE,
        fluid_resuscitation_ml NUMERIC(8,2),
        parkland_total_ml NUMERIC(8,2),
        admission_required BOOLEAN DEFAULT FALSE,
        referral_to_burns_unit BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS dermatology_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        clinician_id UUID NOT NULL,
        note_date DATE NOT NULL,
        consultation_type TEXT CHECK (consultation_type IN ('new','follow_up','procedure','emergency')),
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        procedures JSONB DEFAULT '[]',
        follow_up_weeks SMALLINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint75PalliativeCareModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS palliative_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        clinician_id UUID NOT NULL,
        assessment_date TIMESTAMPTZ NOT NULL,
        ecog_ps SMALLINT CHECK (ecog_ps BETWEEN 0 AND 4),
        kps SMALLINT CHECK (kps BETWEEN 0 AND 100),
        palliative_phase TEXT CHECK (palliative_phase IN ('palliative','end_of_life','terminal','bereavement')),
        ppi_score NUMERIC(5,2),
        pps_score SMALLINT,
        clinician_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pall_assess_patient ON palliative_assessments (patient_id, assessment_date DESC)`,
      `CREATE TABLE IF NOT EXISTS symptom_burden_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pain_score SMALLINT CHECK (pain_score BETWEEN 0 AND 10),
        tiredness_score SMALLINT CHECK (tiredness_score BETWEEN 0 AND 10),
        nausea_score SMALLINT CHECK (nausea_score BETWEEN 0 AND 10),
        depression_score SMALLINT CHECK (depression_score BETWEEN 0 AND 10),
        anxiety_score SMALLINT CHECK (anxiety_score BETWEEN 0 AND 10),
        drowsiness_score SMALLINT CHECK (drowsiness_score BETWEEN 0 AND 10),
        appetite_score SMALLINT CHECK (appetite_score BETWEEN 0 AND 10),
        wellbeing_score SMALLINT CHECK (wellbeing_score BETWEEN 0 AND 10),
        dyspnoea_score SMALLINT CHECK (dyspnoea_score BETWEEN 0 AND 10),
        esas_total SMALLINT GENERATED ALWAYS AS (
          COALESCE(pain_score,0)+COALESCE(tiredness_score,0)+COALESCE(nausea_score,0)+COALESCE(depression_score,0)+
          COALESCE(anxiety_score,0)+COALESCE(drowsiness_score,0)+COALESCE(appetite_score,0)+
          COALESCE(wellbeing_score,0)+COALESCE(dyspnoea_score,0)
        ) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_esas_patient ON symptom_burden_scores (patient_id, recorded_at DESC)`,
      `CREATE TABLE IF NOT EXISTS goals_of_care (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        documented_by UUID NOT NULL,
        document_date DATE NOT NULL,
        cpr_wish TEXT CHECK (cpr_wish IN ('yes','no','discuss')),
        ventilation_wish TEXT CHECK (ventilation_wish IN ('yes','no','discuss')),
        artificial_nutrition_wish TEXT CHECK (artificial_nutrition_wish IN ('yes','no','discuss')),
        hospital_admission_wish TEXT CHECK (hospital_admission_wish IN ('yes','no','comfort','discuss')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_of_care_active ON goals_of_care (patient_id) WHERE is_active = TRUE`,
      `CREATE TABLE IF NOT EXISTS advance_directive_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        document_type TEXT NOT NULL,
        document_date DATE NOT NULL,
        summary TEXT,
        witness_name TEXT,
        physician_name TEXT,
        storage_key TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        superseded_by_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS palliative_medication_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        reviewed_by UUID NOT NULL,
        review_date TIMESTAMPTZ NOT NULL,
        opioid_equivalence_mg_oral NUMERIC(8,2),
        syringe_driver_contents JSONB NOT NULL DEFAULT '[]',
        prn_medications JSONB NOT NULL DEFAULT '[]',
        discontinued_medications JSONB NOT NULL DEFAULT '[]',
        route_of_administration TEXT,
        bowel_care_plan TEXT,
        anticipatory_medications JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ];
  }

  private getSprint76NutritionModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS nutritional_screenings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        screened_by UUID NOT NULL,
        screening_tool TEXT NOT NULL CHECK (screening_tool IN ('NRS2002','MUST','MNA','STAMP_pediatric','SNAQ')),
        total_score SMALLINT NOT NULL,
        risk_category TEXT NOT NULL CHECK (risk_category IN ('low','moderate','high')),
        follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        screened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_nutr_screen_patient ON nutritional_screenings (patient_id, screened_at DESC)`,
      `CREATE TABLE IF NOT EXISTS nutritional_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        dietitian_id UUID NOT NULL,
        assessment_date DATE NOT NULL,
        sga_score TEXT CHECK (sga_score IN ('A','B','C')),
        body_composition JSONB NOT NULL DEFAULT '{}',
        dietary_history TEXT,
        intolerances TEXT[],
        meal_frequency SMALLINT,
        supplements TEXT[],
        current_weight_kg NUMERIC(6,2),
        ideal_weight_kg NUMERIC(6,2),
        height_cm NUMERIC(5,1),
        bmi NUMERIC(4,1),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS dietary_prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        prescribed_by UUID NOT NULL,
        prescription_date DATE NOT NULL,
        calorie_target NUMERIC(7,1),
        protein_target_g NUMERIC(6,1),
        fluid_target_ml NUMERIC(7,1),
        route TEXT NOT NULL CHECK (route IN ('oral','NGT','PEG','TPN','PN','NJ')),
        formula TEXT,
        special_diet TEXT CHECK (special_diet IN ('standard','diabetic','renal','cardiac','low_sodium','low_fat','ketogenic','high_protein','vegan','gluten_free','other')),
        restrictions JSONB NOT NULL DEFAULT '[]',
        duration_days SMALLINT,
        review_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS nutrition_monitoring (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_by UUID NOT NULL,
        monitoring_date DATE NOT NULL,
        actual_calories_intake NUMERIC(7,1),
        actual_protein_intake_g NUMERIC(6,1),
        oral_intake_percent SMALLINT CHECK (oral_intake_percent BETWEEN 0 AND 100),
        tolerance_issues TEXT,
        weight_kg NUMERIC(6,2),
        albumin_g_dl NUMERIC(4,2),
        prealbumin_mg_dl NUMERIC(5,2),
        plan_adjustment TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_nutr_mon_patient ON nutrition_monitoring (patient_id, monitoring_date DESC)`,
    ];
  }

  private getSprint77IcuModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS icu_admissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        admission_id UUID,
        icu_admission_date TIMESTAMPTZ NOT NULL,
        icu_discharge_date TIMESTAMPTZ,
        admission_source TEXT,
        primary_diagnosis TEXT,
        apache_ii_score SMALLINT,
        sofa_admission SMALLINT,
        icu_discharge_reason TEXT,
        mortality_predicted NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_icu_adm_patient ON icu_admissions (patient_id, icu_admission_date DESC)`,
      `CREATE TABLE IF NOT EXISTS sofa_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pao2_fio2 NUMERIC(6,1),
        respiration SMALLINT CHECK (respiration BETWEEN 0 AND 4),
        platelets NUMERIC(7,0),
        coagulation SMALLINT CHECK (coagulation BETWEEN 0 AND 4),
        bilirubin_umol NUMERIC(7,1),
        liver SMALLINT CHECK (liver BETWEEN 0 AND 4),
        map_mmhg NUMERIC(5,1),
        vasopressors TEXT,
        cardiovascular SMALLINT CHECK (cardiovascular BETWEEN 0 AND 4),
        gcs SMALLINT CHECK (gcs BETWEEN 3 AND 15),
        cns SMALLINT CHECK (cns BETWEEN 0 AND 4),
        creatinine_umol NUMERIC(7,1),
        urine_output_ml NUMERIC(7,1),
        renal SMALLINT CHECK (renal BETWEEN 0 AND 4),
        total_sofa SMALLINT,
        delta_sofa SMALLINT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sofa_patient ON sofa_scores (patient_id, scored_at DESC)`,
      `CREATE TABLE IF NOT EXISTS ventilator_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('AC_VC','AC_PC','SIMV','CPAP','PRVC','BiPAP','HFNC','NIV_CPAP','NIV_BiPAP')),
        tidal_volume_ml NUMERIC(6,1),
        rate SMALLINT,
        fio2_pct NUMERIC(5,2),
        peep_cmh2o NUMERIC(5,1),
        i_pressure_cmh2o NUMERIC(5,1),
        pip_cmh2o NUMERIC(5,1),
        map_airway NUMERIC(5,1),
        compliance_ml_cmh2o NUMERIC(6,2),
        spo2_pct NUMERIC(5,2),
        pao2_kpa NUMERIC(5,1),
        paco2_kpa NUMERIC(5,1),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_vent_patient ON ventilator_settings (patient_id, recorded_at DESC)`,
      `CREATE TABLE IF NOT EXISTS sedation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        rass_target SMALLINT CHECK (rass_target BETWEEN -5 AND 4),
        rass_actual SMALLINT CHECK (rass_actual BETWEEN -5 AND 4),
        cam_icu_result TEXT CHECK (cam_icu_result IN ('positive','negative','unable_to_assess')),
        analgesic JSONB NOT NULL DEFAULT '{}',
        sedative JSONB NOT NULL DEFAULT '{}',
        nmba_used BOOLEAN NOT NULL DEFAULT FALSE,
        sab_hold_date DATE,
        wakefulness_trial_completed BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sed_patient ON sedation_records (patient_id, recorded_at DESC)`,
      `CREATE TABLE IF NOT EXISTS central_line_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        line_type TEXT NOT NULL CHECK (line_type IN ('CVL','arterial','PICC','Midline','PA_catheter','dialysis')),
        site TEXT,
        insertion_date DATE NOT NULL,
        removal_date DATE,
        inserted_by UUID,
        indication TEXT,
        dressing_changes JSONB NOT NULL DEFAULT '[]',
        complications JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_line_patient ON central_line_records (patient_id, insertion_date DESC)`,
      `CREATE TABLE IF NOT EXISTS vasopressor_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        drug TEXT NOT NULL,
        dose NUMERIC(8,3),
        unit TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        stop_time TIMESTAMPTZ,
        titrations JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_vaso_patient ON vasopressor_records (patient_id, start_time DESC)`,
    ];
  }

  private getSprint104TelemedicineVideoStatements(): string[] {
    return [
      `ALTER TABLE telemedicine_consultations
         ADD COLUMN IF NOT EXISTS recording_download_url TEXT,
         ADD COLUMN IF NOT EXISTS recording_fetched_at TIMESTAMP WITH TIME ZONE`,
    ];
  }

  private getSprint106TelemedicineFixesStatements(): string[] {
    return [
      `ALTER TABLE telemedicine_consultations
         ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_tele_upcoming_reminder
         ON telemedicine_consultations (scheduled_start_time)
         WHERE status = 'scheduled' AND reminder_sent_at IS NULL`,
    ];
  }

  private getSprint107TelemedicinePostvisitBridgeStatements(): string[] {
    return [
      `ALTER TABLE post_visit_sessions
         ADD COLUMN IF NOT EXISTS recording_sha256 TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_pvs_consultation_id
         ON post_visit_sessions (consultation_id)
         WHERE consultation_id IS NOT NULL`,
    ];
  }

  private getSprint109NotificationPersistenceStatements(): string[] {
    return [
      `ALTER TABLE nurse_tasks
         ADD COLUMN IF NOT EXISTS viewed_at   TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS viewed_by   UUID REFERENCES users(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_unseen
         ON nurse_tasks(assigned_to, viewed_at)
         WHERE status IN ('pending', 'in_progress') AND viewed_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS staff_notifications (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         VARCHAR(120) NOT NULL,
        recipient_id      UUID         NOT NULL,
        recipient_role    VARCHAR(50),
        notification_type VARCHAR(60)  NOT NULL,
        title             VARCHAR(255) NOT NULL,
        message           TEXT         NOT NULL,
        action_url        VARCHAR(500),
        action_label      VARCHAR(100),
        priority          VARCHAR(20)  NOT NULL DEFAULT 'normal',
        read              BOOLEAN      NOT NULL DEFAULT FALSE,
        read_at           TIMESTAMPTZ,
        source_entity_id  UUID,
        metadata          JSONB,
        expires_at        TIMESTAMPTZ,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_staff_notif_recipient
         ON staff_notifications(tenant_id, recipient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_staff_notif_unread
         ON staff_notifications(tenant_id, recipient_id, read)
         WHERE read = FALSE`,
      `CREATE INDEX IF NOT EXISTS idx_staff_notif_source
         ON staff_notifications(tenant_id, recipient_id, source_entity_id, notification_type)
         WHERE source_entity_id IS NOT NULL AND read = FALSE`,
      `CREATE INDEX IF NOT EXISTS idx_staff_notif_expires
         ON staff_notifications(expires_at)
         WHERE expires_at IS NOT NULL`,
    ];
  }

  private getSprint111SchemaCleanupStatements(): string[] {
    return [
      `ALTER TABLE IF EXISTS dialysis_records DROP COLUMN IF EXISTS urrpercent`,
    ];
  }

  private getSprint111AiAuditHardeningStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `ALTER TABLE IF EXISTS hipaa_audit_logs
        ADD COLUMN IF NOT EXISTS event_type VARCHAR(80),
        ADD COLUMN IF NOT EXISTS operation VARCHAR(20)
          CHECK (operation IN ('READ', 'WRITE', 'DELETE', 'EXPORT', 'PRINT', 'SHARE')),
        ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20)
          CHECK (data_classification IN ('PHI', 'CLINICAL', 'BILLING', 'ADMIN')),
        ADD COLUMN IF NOT EXISTS request_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,
        ADD COLUMN IF NOT EXISTS changes_delta JSONB,
        ADD COLUMN IF NOT EXISTS immutable BOOLEAN NOT NULL DEFAULT TRUE`,
      `UPDATE hipaa_audit_logs SET immutable = TRUE WHERE immutable IS DISTINCT FROM TRUE`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_event_type ON hipaa_audit_logs(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_operation ON hipaa_audit_logs(operation)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_data_classification ON hipaa_audit_logs(data_classification)`,
      `CREATE INDEX IF NOT EXISTS idx_hipaa_audit_request_id ON hipaa_audit_logs(request_id)`,
      `CREATE TABLE IF NOT EXISTS audit_integrity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_date DATE NOT NULL UNIQUE,
        event_count INTEGER NOT NULL DEFAULT 0,
        merkle_root_hash TEXT NOT NULL,
        chain_hash TEXT,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_integrity_generated_at ON audit_integrity_log(generated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_integrity_date ON audit_integrity_log(audit_date DESC)`,
      `CREATE TABLE IF NOT EXISTS ai_model_audit_registry (
        model_id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_version TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local',
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'retired', 'testing')),
        sha256_hash TEXT,
        benchmark_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
        deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        retired_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_model_audit_registry_status ON ai_model_audit_registry(status)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_model_audit_registry_model_name ON ai_model_audit_registry(model_name)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_model_audit_registry_deployed_at ON ai_model_audit_registry(deployed_at DESC)`,
      `CREATE TABLE IF NOT EXISTS prompt_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_hash TEXT NOT NULL,
        template_version TEXT NOT NULL DEFAULT 'v1',
        model_id TEXT NOT NULL REFERENCES ai_model_audit_registry(model_id) ON DELETE RESTRICT,
        session_id UUID REFERENCES post_visit_sessions(id) ON DELETE SET NULL,
        patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
        encounter_id UUID,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_role VARCHAR(40),
        input_token_count INTEGER NOT NULL DEFAULT 0,
        output_token_count INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        safety_gate_triggered BOOLEAN NOT NULL DEFAULT FALSE,
        request_id VARCHAR(120),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_prompt_hash ON prompt_audit_log(prompt_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_model_id ON prompt_audit_log(model_id)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_patient_id ON prompt_audit_log(patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_session_id ON prompt_audit_log(session_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_prompt_audit_created_at ON prompt_audit_log(created_at DESC)`,
      `CREATE OR REPLACE FUNCTION prevent_hipaa_audit_logs_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'hipaa_audit_logs is append-only and cannot be %', TG_OP;
        END;
        $$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_update ON hipaa_audit_logs`,
      `CREATE TRIGGER trg_prevent_hipaa_audit_logs_update
        BEFORE UPDATE ON hipaa_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation()`,
      `DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_delete ON hipaa_audit_logs`,
      `CREATE TRIGGER trg_prevent_hipaa_audit_logs_delete
        BEFORE DELETE ON hipaa_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation()`,
    ];
  }

  private getSprint103ModelRegistryStatements(): string[] {
    return [
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'model_registry'
            AND column_name = 'model_id'
        ) THEN
          ALTER TABLE model_registry RENAME TO ai_model_audit_registry;
        END IF;
      END $$`,
      `CREATE TABLE IF NOT EXISTS model_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(50) NOT NULL,
        version VARCHAR(20) NOT NULL,
        round_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'staging',
        deployment_stage VARCHAR(20) NOT NULL DEFAULT 'development',
        minio_path TEXT NOT NULL,
        auc_roc FLOAT,
        brier_score FLOAT,
        sample_count INTEGER NOT NULL DEFAULT 0,
        tenant_count INTEGER NOT NULL DEFAULT 0,
        model_hash VARCHAR(64),
        feature_names JSONB NOT NULL DEFAULT '[]',
        framework VARCHAR(20) NOT NULL DEFAULT 'sklearn',
        promotion_blocked_reason TEXT,
        promoted_at TIMESTAMPTZ,
        retired_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS version VARCHAR(20)`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS round_id UUID`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS deployment_stage VARCHAR(20) NOT NULL DEFAULT 'development'`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS minio_path TEXT`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS auc_roc FLOAT`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS brier_score FLOAT`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS sample_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS tenant_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS model_hash VARCHAR(64)`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS feature_names JSONB NOT NULL DEFAULT '[]'`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS framework VARCHAR(20) NOT NULL DEFAULT 'sklearn'`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS promotion_blocked_reason TEXT`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ`,
      `ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ`,
      `UPDATE model_registry
         SET deployment_stage = CASE
           WHEN status = 'production' THEN 'production'
           WHEN status = 'retired' THEN 'rolled_back'
           ELSE 'development'
         END
       WHERE deployment_stage IS NULL
          OR deployment_stage = ''
          OR (deployment_stage = 'development' AND status IN ('production', 'retired'))`,
      `CREATE INDEX IF NOT EXISTS idx_model_reg_name_status ON model_registry(model_name, status)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_model_reg_production ON model_registry(model_name) WHERE status='production'`,
      `CREATE INDEX IF NOT EXISTS idx_model_reg_stage ON model_registry(model_name, deployment_stage)`,
      `CREATE TABLE IF NOT EXISTS model_promotion_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_registry_id UUID NOT NULL,
        model_name VARCHAR(50) NOT NULL,
        candidate_version VARCHAR(20) NOT NULL,
        requested_stage VARCHAR(20) NOT NULL,
        review_status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
        requested_by VARCHAR(150),
        decision_by VARCHAR(150),
        decision_notes TEXT,
        metric_summary JSONB NOT NULL DEFAULT '{}',
        shadow_validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
        calibration_passed BOOLEAN NOT NULL DEFAULT FALSE,
        fairness_passed BOOLEAN NOT NULL DEFAULT FALSE,
        rollback_ready BOOLEAN NOT NULL DEFAULT FALSE,
        clinical_approval BOOLEAN NOT NULL DEFAULT FALSE,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_model_promotion_reviews_model
         ON model_promotion_reviews(model_name, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_model_promotion_reviews_registry
         ON model_promotion_reviews(model_registry_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_model_promotion_reviews_status
         ON model_promotion_reviews(review_status, requested_stage)`,
      `CREATE TABLE IF NOT EXISTS model_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(50) NOT NULL UNIQUE,
        model_family VARCHAR(40) NOT NULL DEFAULT 'local_ml',
        latest_registry_id UUID,
        current_version VARCHAR(20),
        deployment_stage VARCHAR(20) NOT NULL DEFAULT 'development',
        intended_use TEXT,
        limitations TEXT,
        clinical_scope TEXT,
        training_summary JSONB NOT NULL DEFAULT '{}',
        evaluation_summary JSONB NOT NULL DEFAULT '{}',
        governance_summary JSONB NOT NULL DEFAULT '{}',
        last_reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_model_cards_stage ON model_cards(deployment_stage, model_name)`,
      `CREATE TABLE IF NOT EXISTS model_shadow_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(80) NOT NULL,
        evaluation_kind VARCHAR(40) NOT NULL DEFAULT 'governed_shadow',
        evaluation_status VARCHAR(30) NOT NULL DEFAULT 'review_pending',
        candidate_registry_id UUID,
        candidate_version VARCHAR(20),
        production_registry_id UUID,
        production_version VARCHAR(20),
        fl_round_id UUID,
        source_job_count INTEGER NOT NULL DEFAULT 0,
        source_job_ids JSONB NOT NULL DEFAULT '[]',
        summary JSONB NOT NULL DEFAULT '{}',
        requested_by VARCHAR(150),
        decision_notes TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_model_shadow_evaluations_model
         ON model_shadow_evaluations(model_name, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_model_shadow_evaluations_status
         ON model_shadow_evaluations(evaluation_status, model_name, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_model_shadow_evaluations_round
         ON model_shadow_evaluations(fl_round_id)`,
      `CREATE TABLE IF NOT EXISTS outcome_learning_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedback_log_id UUID NOT NULL UNIQUE,
        tenant_subdomain VARCHAR(120) NOT NULL,
        patient_id UUID NOT NULL,
        decision_type VARCHAR(60) NOT NULL,
        model_name VARCHAR(80) NOT NULL,
        job_status VARCHAR(30) NOT NULL DEFAULT 'claimed',
        source_kind VARCHAR(40) NOT NULL DEFAULT 'outcome_feedback',
        claim_batch_id TEXT,
        processing_notes TEXT,
        payload JSONB NOT NULL DEFAULT '{}',
        claimed_at TIMESTAMPTZ,
        queued_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_outcome_learning_jobs_status
         ON outcome_learning_jobs(job_status, model_name, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_outcome_learning_jobs_tenant
         ON outcome_learning_jobs(tenant_subdomain, created_at DESC)`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS model_id`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS model_version`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS provider`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS sha256_hash`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS benchmark_scores`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS deployed_at`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS metadata`,
      `ALTER TABLE model_registry DROP COLUMN IF EXISTS updated_at`,
    ];
  }

  private getSprint96RadiologyAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS dicom_studies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        imaging_order_id UUID,
        study_uid VARCHAR(200) NOT NULL UNIQUE,
        modality VARCHAR(20) NOT NULL,
        body_part VARCHAR(50),
        storage_key TEXT NOT NULL,
        file_size_bytes BIGINT DEFAULT 0,
        ai_analysis_requested BOOLEAN NOT NULL DEFAULT FALSE,
        ai_analysis_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        acquired_at TIMESTAMPTZ,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_dicom_patient ON dicom_studies(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_dicom_status ON dicom_studies(ai_analysis_status)`,
      `CREATE TABLE IF NOT EXISTS radiology_ai_findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        modality VARCHAR(20) NOT NULL,
        findings JSONB NOT NULL DEFAULT '[]',
        top_finding TEXT,
        overall_confidence FLOAT,
        heatmap_storage_key TEXT,
        model_version VARCHAR(50),
        radiologist_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        radiologist_notes TEXT,
        alerted BOOLEAN NOT NULL DEFAULT FALSE,
        analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_rad_findings_study ON radiology_ai_findings(study_id)`,
      `CREATE INDEX IF NOT EXISTS idx_rad_findings_patient ON radiology_ai_findings(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_rad_findings_alerted ON radiology_ai_findings(alerted) WHERE alerted=TRUE`,
    ];
  }

  private getSprint97AlertDeliveryStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS clinical_alert_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL,
        source_entity_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        recipient_user_id UUID NOT NULL,
        recipient_role VARCHAR(30),
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        websocket_sent BOOLEAN NOT NULL DEFAULT FALSE,
        fcm_sent BOOLEAN NOT NULL DEFAULT FALSE,
        sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
        acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_alert_del_recipient ON clinical_alert_deliveries(recipient_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_alert_del_patient ON clinical_alert_deliveries(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_alert_del_ack ON clinical_alert_deliveries(acknowledged) WHERE acknowledged=FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS on_call BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
    ];
  }

  private getSprint98ModelMonitoringStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS model_performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(50) NOT NULL,
        evaluation_period VARCHAR(10) NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        auc_roc FLOAT,
        brier_score FLOAT,
        sensitivity FLOAT,
        specificity FLOAT,
        ppv FLOAT,
        calibration_data JSONB,
        drift_detected BOOLEAN NOT NULL DEFAULT FALSE,
        baseline_auc FLOAT,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mpf_model_period ON model_performance_metrics(model_name, evaluation_period)`,
      `CREATE INDEX IF NOT EXISTS idx_mpf_drift ON model_performance_metrics(drift_detected) WHERE drift_detected=TRUE`,
      `CREATE TABLE IF NOT EXISTS model_fairness_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(50) NOT NULL,
        evaluation_period VARCHAR(10) NOT NULL,
        dimension VARCHAR(30) NOT NULL,
        group_metrics JSONB NOT NULL DEFAULT '{}',
        max_disparity FLOAT,
        fairness_flag BOOLEAN NOT NULL DEFAULT FALSE,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mfr_model ON model_fairness_reports(model_name, evaluation_period)`,
      `CREATE INDEX IF NOT EXISTS idx_mfr_flag ON model_fairness_reports(fairness_flag) WHERE fairness_flag=TRUE`,
    ];
  }

  private getSprint99PatientAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS symptom_checker_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        reported_symptoms JSONB NOT NULL DEFAULT '[]',
        duration_days INTEGER,
        severity VARCHAR(20),
        differential JSONB NOT NULL DEFAULT '[]',
        triage_level VARCHAR(20),
        recommended_action TEXT,
        escalated_to_encounter BOOLEAN NOT NULL DEFAULT FALSE,
        encounter_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_symptom_patient ON symptom_checker_sessions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_symptom_triage ON symptom_checker_sessions(triage_level)`,
      `CREATE TABLE IF NOT EXISTS adherence_chat_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        session_id UUID NOT NULL,
        message_role VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        intent VARCHAR(30),
        medications_discussed JSONB NOT NULL DEFAULT '[]',
        adherence_concern_flagged BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_adherence_patient ON adherence_chat_logs(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_adherence_session ON adherence_chat_logs(session_id)`,
    ];
  }

  private getSprint100TrialMatchingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS trial_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        nct_id VARCHAR(20) NOT NULL,
        trial_title TEXT NOT NULL,
        phase VARCHAR(20),
        condition VARCHAR(200) NOT NULL,
        eligibility_score FLOAT NOT NULL DEFAULT 0,
        inclusion_met JSONB NOT NULL DEFAULT '[]',
        exclusion_flags JSONB NOT NULL DEFAULT '[]',
        sponsor VARCHAR(200),
        locations JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(20) NOT NULL DEFAULT 'matched',
        contact_email VARCHAR(200),
        matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(patient_id, nct_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trial_patient ON trial_matches(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trial_condition ON trial_matches(condition)`,
      `CREATE INDEX IF NOT EXISTS idx_trial_status ON trial_matches(status)`,
    ];
  }

  private getSprint101SupplyChainAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS pharmacy_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drug_id UUID NOT NULL,
        drug_name VARCHAR(200) NOT NULL,
        quantity_on_hand FLOAT NOT NULL DEFAULT 0,
        unit VARCHAR(20),
        reorder_level FLOAT DEFAULT 30,
        reorder_quantity FLOAT,
        last_counted_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ph_inv_drug ON pharmacy_inventory(drug_id)`,
      `CREATE TABLE IF NOT EXISTS stockout_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drug_id UUID,
        drug_name VARCHAR(200) NOT NULL,
        current_stock_units FLOAT NOT NULL DEFAULT 0,
        avg_daily_consumption FLOAT NOT NULL DEFAULT 0,
        days_to_stockout FLOAT,
        predicted_stockout_date DATE,
        safety_stock_days FLOAT NOT NULL DEFAULT 30,
        reorder_quantity FLOAT,
        risk_level VARCHAR(20) NOT NULL,
        seasonal_factor FLOAT NOT NULL DEFAULT 1.0,
        predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_stockout_drug ON stockout_predictions(drug_name)`,
      `CREATE INDEX IF NOT EXISTS idx_stockout_risk ON stockout_predictions(risk_level)`,
      `CREATE TABLE IF NOT EXISTS procurement_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prediction_id UUID NOT NULL,
        drug_name VARCHAR(200) NOT NULL,
        days_to_stockout FLOAT NOT NULL,
        recommended_order_qty FLOAT NOT NULL,
        urgency VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        acknowledged_by UUID,
        acknowledged_at TIMESTAMPTZ,
        order_reference VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_proc_alert_drug ON procurement_alerts(drug_name)`,
      `CREATE INDEX IF NOT EXISTS idx_proc_alert_status ON procurement_alerts(status)`,
    ];
  }

  private getSprint89PredictiveRiskStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS deterioration_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        admission_id UUID,
        prediction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deterioration_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        predicted_event_type VARCHAR(50),
        predicted_timeframe_hours INTEGER,
        feature_contributions JSONB NOT NULL DEFAULT '{}',
        triggered_alert BOOLEAN NOT NULL DEFAULT FALSE,
        model_used VARCHAR(50) DEFAULT 'MEWS',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_det_pred_patient ON deterioration_predictions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_det_pred_alert ON deterioration_predictions(triggered_alert) WHERE triggered_alert = TRUE`,
      `CREATE TABLE IF NOT EXISTS readmission_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        discharge_id UUID,
        prediction_date DATE NOT NULL,
        readmission_30day_risk NUMERIC(5,4) NOT NULL DEFAULT 0,
        risk_category VARCHAR(20) NOT NULL DEFAULT 'low',
        key_risk_factors JSONB NOT NULL DEFAULT '[]',
        recommended_followup_interval INTEGER,
        prediction_model VARCHAR(50) DEFAULT 'LACE+',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_readm_pred_patient ON readmission_predictions(patient_id)`,
    ];
  }

  private getSprint90FederatedLearningStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS fl_rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        round_number INTEGER NOT NULL,
        global_model_version VARCHAR(100) NOT NULL,
        model_type VARCHAR(50) NOT NULL,
        participating_tenants JSONB NOT NULL DEFAULT '[]',
        aggregated_metrics JSONB NOT NULL DEFAULT '{}',
        model_weights_ref TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fl_rounds_type ON fl_rounds(model_type)`,
      `CREATE TABLE IF NOT EXISTS fl_participation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        round_id UUID NOT NULL,
        tenant_subdomain VARCHAR(100) NOT NULL,
        local_model_metrics JSONB NOT NULL DEFAULT '{}',
        sample_count INTEGER NOT NULL DEFAULT 0,
        gradient_norm NUMERIC(10,6),
        privacy_epsilon NUMERIC(10,6),
        status VARCHAR(20) NOT NULL DEFAULT 'submitted',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fl_logs_round ON fl_participation_logs(round_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fl_logs_tenant ON fl_participation_logs(tenant_subdomain)`,
    ];
  }

  private getSprint91HimisReportingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS mohcc_report_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type VARCHAR(50) NOT NULL,
        period_label VARCHAR(20) NOT NULL,
        facility_code VARCHAR(50),
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        response_code VARCHAR(10),
        response_message TEXT,
        submitted_by VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mohcc_subs_period ON mohcc_report_submissions(period_label)`,
      `CREATE INDEX IF NOT EXISTS idx_mohcc_subs_type ON mohcc_report_submissions(report_type)`,
      `CREATE TABLE IF NOT EXISTS openmrs_migration_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        openmrs_uuid VARCHAR(100),
        medicore_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'migrated',
        error_details TEXT,
        raw_record JSONB,
        migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_openmrs_batch ON openmrs_migration_logs(batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_openmrs_uuid ON openmrs_migration_logs(openmrs_uuid)`,
    ];
  }

  private getSprint92FhirInboundStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS fhir_ingestion_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_system VARCHAR(100) NOT NULL,
        bundle_id VARCHAR(200),
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resources_received INTEGER NOT NULL DEFAULT 0,
        resources_imported INTEGER NOT NULL DEFAULT 0,
        conflicts_detected INTEGER NOT NULL DEFAULT 0,
        conflicts_resolved INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error_details JSONB
      )`,
      `CREATE INDEX IF NOT EXISTS idx_fhir_ingestion_source ON fhir_ingestion_logs(source_system)`,
      `CREATE INDEX IF NOT EXISTS idx_fhir_ingestion_status ON fhir_ingestion_logs(status)`,
    ];
  }

  private getSprint93MultilingualEducationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_education_materials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        encounter_id UUID,
        topic VARCHAR(200) NOT NULL,
        language VARCHAR(10) NOT NULL DEFAULT 'en',
        reading_level INTEGER NOT NULL DEFAULT 6,
        content TEXT NOT NULL DEFAULT '',
        content_html TEXT,
        pdf_storage_key VARCHAR(500),
        ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        delivery_method VARCHAR(20),
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_edu_patient ON patient_education_materials(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_edu_language ON patient_education_materials(language)`,
    ];
  }

  private getSprint94OfflineSyncStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS sync_queue_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR(100) NOT NULL,
        operation_type VARCHAR(20) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        payload JSONB NOT NULL DEFAULT '{}',
        client_timestamp TIMESTAMPTZ NOT NULL,
        server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        conflict_details JSONB
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sync_client ON sync_queue_logs(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue_logs(sync_status)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_queue_logs(entity_type, entity_id)`,
    ];
  }

  private getSprint95IotWearablesStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS iot_device_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        device_type VARCHAR(50) NOT NULL,
        device_name VARCHAR(100),
        manufacturer VARCHAR(100),
        model VARCHAR(100),
        serial_number VARCHAR(100),
        oauth_token_encrypted TEXT,
        webhook_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_sync_at TIMESTAMPTZ,
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_iot_device_patient ON iot_device_registrations(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_iot_device_status ON iot_device_registrations(status)`,
      `CREATE TABLE IF NOT EXISTS iot_data_ingestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        device_id UUID NOT NULL,
        measurement_type VARCHAR(100) NOT NULL,
        value NUMERIC(12,4) NOT NULL,
        unit VARCHAR(20),
        measured_at TIMESTAMPTZ NOT NULL,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fhir_observation_id VARCHAR(200),
        ai_processed BOOLEAN NOT NULL DEFAULT FALSE,
        alert_triggered BOOLEAN NOT NULL DEFAULT FALSE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_iot_data_patient ON iot_data_ingestions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_iot_data_device ON iot_data_ingestions(device_id)`,
      `CREATE INDEX IF NOT EXISTS idx_iot_data_type ON iot_data_ingestions(measurement_type)`,
      `CREATE INDEX IF NOT EXISTS idx_iot_data_alert ON iot_data_ingestions(alert_triggered) WHERE alert_triggered = TRUE`,
    ];
  }

  private getSprint88FormularyOptimizationStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS formulary_ai_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID,
        patient_id UUID NOT NULL,
        branded_drug TEXT NOT NULL,
        generic_alternative TEXT,
        branded_cost NUMERIC,
        generic_cost NUMERIC,
        saving_amount NUMERIC,
        medical_aid_coverage BOOLEAN NOT NULL DEFAULT FALSE,
        medical_aid_tier INT,
        evidence_equivalence TEXT,
        ai_recommendation TEXT NOT NULL,
        reason TEXT,
        accepted BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_formulary_patient ON formulary_ai_suggestions (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_formulary_prescription ON formulary_ai_suggestions (prescription_id)`,
      `ALTER TABLE drugs ADD COLUMN IF NOT EXISTS generic_name_canonical VARCHAR(255)`,
      `ALTER TABLE drugs ADD COLUMN IF NOT EXISTS formulary_tier INT`,
      `ALTER TABLE drugs ADD COLUMN IF NOT EXISTS average_unit_cost_usd DECIMAL(10,4)`,
      `ALTER TABLE drugs ADD COLUMN IF NOT EXISTS bioequivalent_group VARCHAR(100)`,
    ];
  }

  private getSprint87SmartDefaultsStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS form_intelligence_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        form_name TEXT NOT NULL,
        visibility_rules JSONB NOT NULL DEFAULT '[]',
        default_rules JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_form_intel_name ON form_intelligence_configs (form_name)`,
    ];
  }

  private getSprint86SmartSchedulingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS scheduling_ai_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL UNIQUE,
        no_show_probability NUMERIC NOT NULL,
        cancel_probability NUMERIC NOT NULL,
        recommended_duration INT,
        confidence_score NUMERIC NOT NULL,
        feature_importance JSONB NOT NULL DEFAULT '{}',
        model TEXT,
        prediction_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sched_pred_apt ON scheduling_ai_predictions (appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sched_pred_noshw ON scheduling_ai_predictions (no_show_probability DESC)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ai_recommended_duration INT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_risk VARCHAR(20)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS overbooking_slot BOOLEAN DEFAULT FALSE`,
    ];
  }

  private getSprint84AiExplainabilityStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS ai_recommendation_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        decision_log_id UUID,
        recommendation_type TEXT NOT NULL,
        patient_id UUID,
        confidence NUMERIC,
        reasoning TEXT,
        evidence JSONB NOT NULL DEFAULT '[]',
        alternatives JSONB NOT NULL DEFAULT '[]',
        override_logged BOOLEAN NOT NULL DEFAULT FALSE,
        override_reason TEXT,
        override_by UUID,
        displayed_to_user BOOLEAN NOT NULL DEFAULT FALSE,
        user_read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_audit_patient ON ai_recommendation_audits (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_audit_type ON ai_recommendation_audits (recommendation_type)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_audit_override ON ai_recommendation_audits (override_logged) WHERE override_logged = true`,
    ];
  }

  private getSprint83AntibiogramStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS antibiogram_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organism TEXT NOT NULL,
        antibiotic TEXT NOT NULL,
        year INT NOT NULL,
        quarter SMALLINT,
        susceptible_percent NUMERIC NOT NULL,
        intermediate_percent NUMERIC NOT NULL DEFAULT 0,
        resistant_percent NUMERIC NOT NULL,
        total_isolates INT NOT NULL,
        specimen_type TEXT NOT NULL,
        ward TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_abio_organism ON antibiogram_entries (organism, antibiotic, year)`,
      `CREATE INDEX IF NOT EXISTS idx_abio_specimen ON antibiogram_entries (specimen_type, year)`,
      `CREATE TABLE IF NOT EXISTS antibiogram_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_label TEXT NOT NULL,
        specimen_type TEXT NOT NULL,
        data JSONB NOT NULL,
        top_resistant_organisms JSONB NOT NULL DEFAULT '[]',
        recommended_empirical_choices JSONB NOT NULL DEFAULT '{}',
        generated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (period_label, specimen_type)
      )`,
      `CREATE TABLE IF NOT EXISTS culture_sensitivity_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        lab_order_id UUID,
        specimen_type TEXT NOT NULL,
        collection_date DATE NOT NULL,
        organism_isolated TEXT,
        no_growth BOOLEAN NOT NULL DEFAULT FALSE,
        disk_diffusion_results JSONB NOT NULL DEFAULT '{}',
        mic_values JSONB NOT NULL DEFAULT '{}',
        clsi_breakpoints_used TEXT,
        esbl_detected BOOLEAN,
        carbapenem_resistant BOOLEAN,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_culture_patient ON culture_sensitivity_results (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_culture_organism ON culture_sensitivity_results (organism_isolated)`,
    ];
  }

  private getSprint82PharmacogenomicsStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS pgx_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL UNIQUE,
        genotype_source TEXT NOT NULL DEFAULT 'lab_test',
        report_date DATE,
        cyp2d6_phenotype TEXT,
        cyp2c19_phenotype TEXT,
        cyp2c9_phenotype TEXT,
        vkorc1_variant TEXT,
        tpmt_phenotype TEXT,
        hla_b_5701 TEXT,
        hla_b_1502 TEXT,
        slco1b1_variant TEXT,
        g6pd_status TEXT,
        ugt1a1_phenotype TEXT,
        raw_genotyping_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pgx_profile_patient ON pgx_profiles (patient_id)`,
      `CREATE TABLE IF NOT EXISTS pgx_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        drug TEXT NOT NULL,
        pgx_interaction TEXT NOT NULL,
        clinical_implication TEXT NOT NULL,
        alternative_recommended TEXT,
        severity TEXT NOT NULL,
        gene_involved TEXT,
        acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
        acknowledged_by UUID,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pgx_alert_patient ON pgx_alerts (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pgx_alert_unacked ON pgx_alerts (patient_id, acknowledged)`,
    ];
  }

  private getSprint81AutoCodingStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS auto_coding_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL UNIQUE,
        patient_id UUID NOT NULL,
        encounter_id UUID,
        suggested_icd10_codes JSONB NOT NULL DEFAULT '[]',
        suggested_cpt_codes JSONB NOT NULL DEFAULT '[]',
        review_status TEXT NOT NULL DEFAULT 'pending',
        confirmed_codes JSONB,
        reviewed_by UUID,
        reviewed_at TIMESTAMPTZ,
        coding_model TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_acs_patient ON auto_coding_suggestions (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_acs_status ON auto_coding_suggestions (review_status)`,
      `CREATE INDEX IF NOT EXISTS idx_acs_note ON auto_coding_suggestions (note_id)`,
    ];
  }

  private getSprint80AdvancedHivPmtctPepfarStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS pmtct_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        gestational_age_at_enrollment SMALLINT,
        hiv_status_at_booking TEXT NOT NULL,
        art_started BOOLEAN NOT NULL DEFAULT FALSE,
        art_regimen TEXT,
        viral_load_at_booking NUMERIC,
        viral_load_at_delivery NUMERIC,
        delivery_mode TEXT,
        infant_nvp_provided BOOLEAN NOT NULL DEFAULT FALSE,
        enrollment_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pmtct_enroll_patient ON pmtct_enrollments (patient_id)`,
      `CREATE TABLE IF NOT EXISTS pmtct_infants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mother_patient_id UUID NOT NULL,
        infant_patient_id UUID,
        birth_date DATE NOT NULL,
        birth_weight_kg NUMERIC,
        hiv_test_at_6weeks TEXT,
        dbs_result_6weeks TEXT,
        hiv_test_18months TEXT,
        final_hiv_status TEXT,
        breastfeeding_status TEXT,
        cotrimoxazole_started BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pmtct_infant_mother ON pmtct_infants (mother_patient_id)`,
      `CREATE TABLE IF NOT EXISTS pepfar_mer_indicators (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporting_period TEXT NOT NULL,
        indicator TEXT NOT NULL,
        numerator INT,
        denominator INT,
        disaggregations JSONB NOT NULL DEFAULT '{}',
        submitted_to_datim BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mer_period_indicator ON pepfar_mer_indicators (reporting_period, indicator)`,
      `CREATE TABLE IF NOT EXISTS art_cohorts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cohort_start_date DATE NOT NULL,
        cohort_size INT NOT NULL,
        alive_on_art_12m INT,
        lost_to_followup_12m INT,
        died_12m INT,
        transferred_out_12m INT,
        retention_rate NUMERIC,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_art_cohort_date ON art_cohorts (cohort_start_date DESC)`,
    ];
  }

  private getSprint79NtdRegionalStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS ntd_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        disease TEXT NOT NULL,
        species TEXT,
        acquisition_route TEXT,
        presenting_manifestations TEXT[],
        stool_urine_result TEXT,
        treatment TEXT,
        mass_chemoprophylaxis_campaign BOOLEAN NOT NULL DEFAULT FALSE,
        diagnosis_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ntd_cases_patient ON ntd_cases (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ntd_cases_disease ON ntd_cases (disease)`,
      `CREATE TABLE IF NOT EXISTS cholera_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        case_classification TEXT NOT NULL DEFAULT 'suspected',
        onset DATE NOT NULL,
        dehydration_severity TEXT,
        ivf_given BOOLEAN NOT NULL DEFAULT FALSE,
        oral_rehydration BOOLEAN NOT NULL DEFAULT FALSE,
        antibiotic TEXT,
        contact_tracing JSONB NOT NULL DEFAULT '[]',
        outbreak_cluster TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cholera_patient ON cholera_cases (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cholera_cluster ON cholera_cases (outbreak_cluster)`,
      `CREATE TABLE IF NOT EXISTS typhoid_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        onset_date DATE NOT NULL,
        widal_titer TEXT,
        blood_culture_result TEXT,
        resistance_pattern TEXT[],
        chloramphenicol_sensitivity TEXT,
        treatment TEXT,
        complication TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_typhoid_patient ON typhoid_cases (patient_id)`,
      `CREATE TABLE IF NOT EXISTS regional_disease_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_period TEXT NOT NULL,
        period_type TEXT NOT NULL,
        facility_id TEXT,
        malaria_cases INT NOT NULL DEFAULT 0,
        malaria_deaths INT NOT NULL DEFAULT 0,
        cholera_cases INT NOT NULL DEFAULT 0,
        cholera_deaths INT NOT NULL DEFAULT 0,
        typhoid_cases INT NOT NULL DEFAULT 0,
        ntd_cases INT NOT NULL DEFAULT 0,
        schistosomiasis_cases INT NOT NULL DEFAULT 0,
        submitted_to_mohcc BOOLEAN NOT NULL DEFAULT FALSE,
        submission_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (report_period, period_type)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_rdr_period ON regional_disease_reports (report_period, period_type)`,
    ];
  }

  private getSprint111EntityCompletenessStatements(): string[] {
    return [
      // ── Advance Care Planning ──────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS advance_care_planning (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        created_by UUID NOT NULL,
        document_type TEXT NOT NULL,
        document_date DATE NOT NULL,
        summary TEXT,
        document_storage_key TEXT,
        witness_signed BOOLEAN NOT NULL DEFAULT FALSE,
        physician_signed BOOLEAN NOT NULL DEFAULT FALSE,
        patient_signed BOOLEAN NOT NULL DEFAULT FALSE,
        capacity_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        review_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_acp_patient ON advance_care_planning (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_acp_active ON advance_care_planning (patient_id, is_active)`,

      // ── Appointment Resources & Bookings ───────────────────────────────────
      `CREATE TABLE IF NOT EXISTS appointment_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        capacity INT,
        location VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_appt_resource_type ON appointment_resources (type, is_active)`,
      `CREATE TABLE IF NOT EXISTS appointment_resource_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL,
        resource_id UUID NOT NULL,
        booking_start TIMESTAMPTZ NOT NULL,
        booking_end TIMESTAMPTZ NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_appt_rb_appointment ON appointment_resource_bookings (appointment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_appt_rb_resource ON appointment_resource_bookings (resource_id, booking_start)`,

      // ── Appointment Templates ──────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS appointment_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        duration_minutes INT NOT NULL DEFAULT 30,
        instructions TEXT,
        color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_appt_tmpl_type ON appointment_templates (type, is_active)`,

      // ── Care Gap Detections ────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS care_gap_detections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        detected_by VARCHAR(20) NOT NULL DEFAULT 'cdss',
        gap_type VARCHAR(100) NOT NULL,
        gap_description TEXT NOT NULL,
        recommended_action TEXT,
        due_date DATE,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        icd_code VARCHAR(20),
        linked_task_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_care_gap_patient ON care_gap_detections (patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_care_gap_type ON care_gap_detections (gap_type, status)`,

      // ── CDSS Decision Log (singular — entity table name) ───────────────────
      `CREATE TABLE IF NOT EXISTS cdss_decision_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        encounter_id UUID,
        user_id UUID,
        decision_type VARCHAR(60) NOT NULL,
        cdss_request_payload JSONB NOT NULL DEFAULT '{}',
        cdss_response_payload JSONB NOT NULL DEFAULT '{}',
        top_recommendation TEXT,
        confidence_score NUMERIC(5,4),
        clinician_action VARCHAR(20),
        override_reason TEXT,
        patient_outcome_id UUID,
        outcome_at_30_days JSONB,
        outcome_at_90_days JSONB,
        feedback_sent_to_cdss BOOLEAN NOT NULL DEFAULT FALSE,
        feedback_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_dl_patient ON cdss_decision_log (patient_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_dl_type ON cdss_decision_log (decision_type, created_at DESC)`,
      // Fix: column may have been created as TEXT by TypeORM auto-sync; convert to BOOLEAN safely
      `DO $$
       DECLARE col_type TEXT;
       BEGIN
         SELECT data_type INTO col_type
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'cdss_decision_log'
           AND column_name = 'feedback_sent_to_cdss';
         IF col_type = 'text' THEN
           ALTER TABLE cdss_decision_log
             ALTER COLUMN feedback_sent_to_cdss TYPE BOOLEAN
             USING CASE WHEN lower(feedback_sent_to_cdss) IN ('true','t','yes','1') THEN TRUE ELSE FALSE END;
         END IF;
       END $$`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_dl_feedback ON cdss_decision_log (feedback_sent_to_cdss)`,

      // ── Clinical Pathways ──────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS clinical_pathways (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pathway_code VARCHAR(100) NOT NULL UNIQUE,
        pathway_name VARCHAR(255) NOT NULL,
        pathway_version VARCHAR(20) NOT NULL,
        condition VARCHAR(255) NOT NULL,
        condition_codes JSONB NOT NULL DEFAULT '[]',
        condition_snomed_codes JSONB NOT NULL DEFAULT '[]',
        target_diagnoses_icd10 JSONB NOT NULL DEFAULT '[]',
        specialty VARCHAR(100),
        evidence_level VARCHAR(20),
        guideline_source VARCHAR(255),
        guideline_url TEXT,
        pathway_type VARCHAR(50),
        target_population TEXT,
        inclusion_criteria TEXT,
        inclusion_criteria_snomed JSONB NOT NULL DEFAULT '[]',
        exclusion_criteria TEXT,
        exclusion_criteria_snomed JSONB NOT NULL DEFAULT '[]',
        pathway_duration_days INT,
        expected_outcomes TEXT,
        description TEXT,
        objectives TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        effective_date DATE NOT NULL,
        review_date DATE,
        last_reviewed_by UUID,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cp_code ON clinical_pathways (pathway_code)`,
      `CREATE INDEX IF NOT EXISTS idx_cp_condition ON clinical_pathways (condition, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_cp_specialty ON clinical_pathways (specialty, is_active)`,

      // ── Crisis Events ──────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS crisis_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        reported_by UUID NOT NULL,
        event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        crisis_type TEXT NOT NULL,
        ideation_type TEXT,
        lethality TEXT,
        means_access BOOLEAN NOT NULL DEFAULT FALSE,
        prior_attempts INT NOT NULL DEFAULT 0,
        protective_factors JSONB NOT NULL DEFAULT '[]',
        intervention TEXT,
        outcome TEXT,
        follow_up_plan TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_crisis_patient ON crisis_events (patient_id, event_date DESC)`,

      // ── ED Visits ──────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS ed_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ed_visit_number VARCHAR(50) NOT NULL UNIQUE,
        patient_id UUID NOT NULL,
        arrival_date TIMESTAMPTZ NOT NULL,
        arrival_time TIMESTAMPTZ NOT NULL,
        arrival_mode VARCHAR(50) NOT NULL,
        chief_complaint TEXT NOT NULL,
        chief_complaint_snomed VARCHAR(20),
        chief_complaint_term TEXT,
        presenting_symptoms TEXT,
        presenting_symptoms_coded JSONB NOT NULL DEFAULT '[]',
        triage_level INT,
        triage_acuity VARCHAR(50),
        triage_completed_at TIMESTAMPTZ,
        triage_completed_by UUID,
        vital_signs JSONB,
        allergies TEXT,
        current_medications TEXT,
        last_meal_time TIMESTAMPTZ,
        tetanus_status VARCHAR(50),
        bed_assigned VARCHAR(50),
        room_assigned VARCHAR(50),
        attending_provider UUID,
        primary_nurse UUID,
        ed_status VARCHAR(50) NOT NULL DEFAULT 'waiting',
        fast_track BOOLEAN NOT NULL DEFAULT FALSE,
        trauma_activation BOOLEAN NOT NULL DEFAULT FALSE,
        trauma_level VARCHAR(20),
        code_stroke BOOLEAN NOT NULL DEFAULT FALSE,
        code_stemi BOOLEAN NOT NULL DEFAULT FALSE,
        code_sepsis BOOLEAN NOT NULL DEFAULT FALSE,
        isolation_required BOOLEAN NOT NULL DEFAULT FALSE,
        isolation_precautions VARCHAR(100),
        time_to_provider INT,
        time_to_treatment INT,
        total_ed_time INT,
        disposition VARCHAR(100),
        disposition_time TIMESTAMPTZ,
        discharge_diagnosis TEXT,
        discharge_diagnosis_icd10 VARCHAR(10),
        discharge_diagnosis_snomed VARCHAR(20),
        discharge_diagnosis_term TEXT,
        secondary_diagnoses JSONB NOT NULL DEFAULT '[]',
        procedures_performed JSONB NOT NULL DEFAULT '[]',
        discharge_instructions TEXT,
        follow_up_instructions TEXT,
        left_ama BOOLEAN NOT NULL DEFAULT FALSE,
        return_precautions TEXT,
        prescriptions_given TEXT,
        referrals TEXT,
        notes TEXT,
        quality_flags JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ed_patient ON ed_visits (patient_id, arrival_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ed_status ON ed_visits (ed_status, arrival_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ed_visit_number ON ed_visits (ed_visit_number)`,

      // ── Falls Assessments ──────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS falls_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        morse_score INT,
        fall_history_count INT NOT NULL DEFAULT 0,
        primary_diagnosis TEXT,
        ambulation TEXT,
        iv_line_present BOOLEAN NOT NULL DEFAULT FALSE,
        gait TEXT,
        mental_status TEXT,
        medications JSONB NOT NULL DEFAULT '[]',
        risk_category TEXT,
        prevention_plan TEXT,
        tinnetti_gait INT,
        tinnetti_balance INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_falls_patient ON falls_assessments (patient_id, assessment_date DESC)`,

      // ── Inbox Items ────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS inbox_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        patient_id UUID,
        source_type VARCHAR(50) NOT NULL,
        source_id UUID,
        title VARCHAR(255) NOT NULL,
        preview TEXT,
        ai_priority VARCHAR(20) NOT NULL DEFAULT 'routine',
        ai_priority_reason TEXT,
        ai_draft_reply TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        is_actioned BOOLEAN NOT NULL DEFAULT FALSE,
        actioned_at TIMESTAMPTZ,
        due_by TIMESTAMPTZ,
        triage_score INT,
        triage_model VARCHAR(60),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_items (user_id, is_read, ai_priority)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_patient ON inbox_items (patient_id)`,

      // ── Malaria Contact Tracing ────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS malaria_contact_tracing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        malaria_case_id UUID NOT NULL,
        contact_name TEXT NOT NULL,
        relationship TEXT,
        age_years INT,
        screened_date DATE,
        rdt_result TEXT,
        treated BOOLEAN NOT NULL DEFAULT FALSE,
        irs_applied BOOLEAN NOT NULL DEFAULT FALSE,
        itn_provided BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_malaria_ct_case ON malaria_contact_tracing (malaria_case_id)`,

      // ── Malaria Surveillance Reports ───────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS malaria_surveillance_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_week INT NOT NULL,
        report_year INT NOT NULL,
        facility_id UUID,
        total_tested INT NOT NULL DEFAULT 0,
        total_positive INT NOT NULL DEFAULT 0,
        falciparum_cases INT NOT NULL DEFAULT 0,
        vivax_cases INT NOT NULL DEFAULT 0,
        severe_cases INT NOT NULL DEFAULT 0,
        deaths INT NOT NULL DEFAULT 0,
        act_courses_used INT NOT NULL DEFAULT 0,
        irs_households INT NOT NULL DEFAULT 0,
        itn_distributed INT NOT NULL DEFAULT 0,
        submitted_by UUID,
        submitted_at TIMESTAMPTZ,
        dhis2_synced BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_malaria_sr_week ON malaria_surveillance_reports (report_year, report_week)`,

      // ── Malaria Tests ──────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS malaria_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        malaria_case_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        test_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        test_type TEXT NOT NULL,
        result TEXT NOT NULL,
        species TEXT,
        parasite_density NUMERIC(10,2),
        gametocytes BOOLEAN NOT NULL DEFAULT FALSE,
        performed_by UUID,
        lab_reference TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_malaria_test_case ON malaria_tests (malaria_case_id)`,
      `CREATE INDEX IF NOT EXISTS idx_malaria_test_patient ON malaria_tests (patient_id)`,

      // ── Mental Health Screenings ───────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS mental_health_screenings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        screened_by UUID NOT NULL,
        screened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tool TEXT NOT NULL,
        responses JSONB NOT NULL DEFAULT '{}',
        total_score INT,
        severity TEXT,
        risk_level TEXT,
        action_taken TEXT,
        follow_up_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mhs_patient ON mental_health_screenings (patient_id, screened_at DESC)`,

      // ── Neonatal Records ───────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS neonatal_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        delivery_date DATE,
        delivery_type VARCHAR(20),
        gestational_age_weeks NUMERIC(4,1),
        birth_weight_grams INT,
        apgar_1min INT,
        apgar_5min INT,
        apgar_10min INT,
        resuscitation_required BOOLEAN NOT NULL DEFAULT FALSE,
        resuscitation_details TEXT,
        special_care_unit_admission BOOLEAN NOT NULL DEFAULT FALSE,
        scbu_admission_reason TEXT,
        scbu_discharge_date DATE,
        vitamin_k_given BOOLEAN NOT NULL DEFAULT FALSE,
        eye_prophylaxis_given BOOLEAN NOT NULL DEFAULT FALSE,
        hearing_screen_result VARCHAR(20),
        metabolic_screen_result VARCHAR(20),
        hiv_exposure_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        arvs_given BOOLEAN NOT NULL DEFAULT FALSE,
        discharge_weight_grams INT,
        discharge_date DATE,
        attending_clinician_id UUID,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_neo_patient ON neonatal_records (patient_id)`,

      // ── Neurology Examinations ─────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS neurology_examinations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        examined_by UUID NOT NULL,
        exam_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cranial_nerves JSONB NOT NULL DEFAULT '{}',
        motor_exam JSONB NOT NULL DEFAULT '{}',
        sensory_exam JSONB NOT NULL DEFAULT '{}',
        cerebellar JSONB NOT NULL DEFAULT '{}',
        gait TEXT,
        reflexes JSONB NOT NULL DEFAULT '{}',
        mmt JSONB NOT NULL DEFAULT '{}',
        summary TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_neuro_exam_patient ON neurology_examinations (patient_id, exam_date DESC)`,

      // ── Nurse Tasks ────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS nurse_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assigned_to UUID,
        assigned_by_system BOOLEAN NOT NULL DEFAULT FALSE,
        task_type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE,
        source_type VARCHAR(30),
        source_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        completed_by UUID,
        completed_at TIMESTAMPTZ,
        completion_notes TEXT,
        viewed_at TIMESTAMPTZ,
        viewed_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_patient ON nurse_tasks (patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_assignee ON nurse_tasks (assigned_to, status, due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_nurse_task_type ON nurse_tasks (task_type, status)`,

      // ── Patient SDOH ───────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS patient_sdoh (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        housing_status VARCHAR(30),
        food_security_status VARCHAR(30),
        transportation_access VARCHAR(30),
        social_isolation_score INT,
        financial_strain VARCHAR(30),
        literacy_level VARCHAR(30),
        icd_z_codes JSONB NOT NULL DEFAULT '[]',
        community_resource_referrals JSONB NOT NULL DEFAULT '[]',
        assessed_by UUID,
        next_assessment_due DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_sdoh_patient ON patient_sdoh (patient_id, assessment_date DESC)`,

      // ── Pediatric Profiles ─────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS pediatric_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL UNIQUE,
        gestational_age_weeks NUMERIC(4,1),
        birth_weight_grams INT,
        birth_length_cm NUMERIC(5,1),
        birth_head_circ_cm NUMERIC(5,1),
        apgar_1min INT,
        apgar_5min INT,
        delivery_type VARCHAR(20),
        feeding_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
        neonatal_complications TEXT,
        blood_group VARCHAR(5),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_peds_profile_patient ON pediatric_profiles (patient_id)`,

      // ── Pressure Injury Assessments ────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS pressure_injury_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessed_by UUID NOT NULL,
        assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        braden_score INT,
        existing_injuries JSONB NOT NULL DEFAULT '[]',
        prevention_protocol TEXT,
        repositioning_schedule TEXT,
        special_surface_required BOOLEAN NOT NULL DEFAULT FALSE,
        skin_condition TEXT,
        moisture_management TEXT,
        nutritional_support TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pressure_inj_patient ON pressure_injury_assessments (patient_id, assessment_date DESC)`,

      // ── Psychiatric Encounters ─────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS psychiatric_encounters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        provider_id UUID NOT NULL,
        encounter_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        encounter_type TEXT NOT NULL,
        chief_complaint TEXT,
        mental_status JSONB NOT NULL DEFAULT '{}',
        diagnoses JSONB NOT NULL DEFAULT '[]',
        treatment_plan TEXT,
        risk_assessment JSONB,
        disposition TEXT,
        next_appointment DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_psych_enc_patient ON psychiatric_encounters (patient_id, encounter_date DESC)`,

      // ── Psychotropic Medications ───────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS psychotropic_medications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        prescribed_by UUID NOT NULL,
        drug_name TEXT NOT NULL,
        drug_class TEXT NOT NULL,
        dose_mg NUMERIC(8,2),
        frequency TEXT,
        route TEXT NOT NULL DEFAULT 'oral',
        start_date DATE NOT NULL,
        end_date DATE,
        indication TEXT,
        monitoring_required JSONB NOT NULL DEFAULT '[]',
        last_level_date DATE,
        last_level_value NUMERIC(8,2),
        last_level_unit TEXT,
        adverse_effects TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_psycho_med_patient ON psychotropic_medications (patient_id, status)`,

      // ── Safe Plans ─────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS safe_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        created_by UUID NOT NULL,
        warning_signs JSONB NOT NULL DEFAULT '[]',
        internal_coping JSONB NOT NULL DEFAULT '[]',
        social_distractions JSONB NOT NULL DEFAULT '[]',
        support_contacts JSONB NOT NULL DEFAULT '[]',
        professional_contacts JSONB NOT NULL DEFAULT '[]',
        means_restriction TEXT,
        reason_to_live TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_safe_plan_patient ON safe_plans (patient_id, is_active)`,

      // ── School Health Records ──────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS school_health_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        grade VARCHAR(10),
        school_name VARCHAR(150),
        vision_right VARCHAR(20),
        vision_left VARCHAR(20),
        vision_status VARCHAR(20),
        hearing_status VARCHAR(20),
        dental_status VARCHAR(30),
        immunization_up_to_date BOOLEAN,
        growth_status VARCHAR(30),
        referrals JSONB NOT NULL DEFAULT '[]',
        assessed_by UUID,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_school_health_patient ON school_health_records (patient_id, assessment_date DESC)`,

      // ── TB Patients (entity-based TB registry) ─────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tb_register_number VARCHAR(50),
        notification_date DATE,
        registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
        case_type VARCHAR(30) NOT NULL DEFAULT 'pulmonary',
        treatment_category VARCHAR(20) NOT NULL DEFAULT 'new',
        hiv_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        art_started BOOLEAN NOT NULL DEFAULT FALSE,
        ipt_started BOOLEAN NOT NULL DEFAULT FALSE,
        anatomical_site VARCHAR(100),
        referred_from VARCHAR(100),
        treating_facility VARCHAR(100),
        case_officer_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'on_treatment',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_patient_patient ON tb_patients (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tb_patient_status ON tb_patients (status)`,

      // ── TB Diagnoses ───────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_diagnoses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        diagnosis_date DATE NOT NULL DEFAULT CURRENT_DATE,
        sputum_smear_result VARCHAR(20),
        genexpert_result VARCHAR(30),
        culture_result VARCHAR(20),
        cxr_finding TEXT,
        anatomical_site VARCHAR(100),
        laboratory_id VARCHAR(50),
        reported_by UUID,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_diag_tb_patient ON tb_diagnoses (tb_patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tb_diag_patient ON tb_diagnoses (patient_id)`,

      // ── TB Treatment Episodes ──────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_treatment_episodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        regimen_code VARCHAR(30) NOT NULL,
        regimen_label VARCHAR(100),
        phase VARCHAR(20) NOT NULL DEFAULT 'intensive',
        start_date DATE NOT NULL,
        expected_end DATE,
        actual_end DATE,
        dot_required BOOLEAN NOT NULL DEFAULT TRUE,
        outcome VARCHAR(30),
        outcome_date DATE,
        prescribed_by UUID,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_ep_tb_patient ON tb_treatment_episodes (tb_patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tb_ep_patient ON tb_treatment_episodes (patient_id, start_date DESC)`,

      // ── TB DOT Records ─────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_dot_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        episode_id UUID,
        patient_id UUID NOT NULL,
        dot_date DATE NOT NULL,
        observed BOOLEAN NOT NULL,
        dot_worker_id UUID,
        dot_method VARCHAR(30) NOT NULL DEFAULT 'in_person',
        doses_taken INT NOT NULL DEFAULT 1,
        reason_missed TEXT,
        side_effects TEXT,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_dot_patient ON tb_dot_records (tb_patient_id, dot_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_tb_dot_episode ON tb_dot_records (episode_id, dot_date)`,

      // ── TB Drug Susceptibilities ───────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_drug_susceptibilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        specimen_date DATE NOT NULL,
        reported_date DATE,
        laboratory_id VARCHAR(50),
        isoniazid VARCHAR(20),
        rifampicin VARCHAR(20),
        ethambutol VARCHAR(20),
        pyrazinamide VARCHAR(20),
        streptomycin VARCHAR(20),
        fluoroquinolone VARCHAR(20),
        kanamycin VARCHAR(20),
        resistance_pattern VARCHAR(30),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_dst_tb_patient ON tb_drug_susceptibilities (tb_patient_id)`,

      // ── TB Outcomes ────────────────────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        episode_id UUID,
        outcome VARCHAR(30) NOT NULL,
        outcome_date DATE NOT NULL,
        cause_of_death VARCHAR(200),
        transfer_facility VARCHAR(100),
        recorded_by UUID,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_outcome_tb_patient ON tb_outcomes (tb_patient_id)`,

      // ── TB Contact Investigations ──────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS tb_contact_investigations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tb_patient_id UUID NOT NULL,
        contact_name VARCHAR(150) NOT NULL,
        relationship VARCHAR(50),
        age INT,
        gender VARCHAR(10),
        is_registered_patient BOOLEAN NOT NULL DEFAULT FALSE,
        contact_patient_id UUID,
        screening_date DATE,
        tst_result VARCHAR(20),
        igra_result VARCHAR(20),
        cxr_result TEXT,
        ltbi_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        prophylaxis_started BOOLEAN NOT NULL DEFAULT FALSE,
        prophylaxis_regimen VARCHAR(50),
        tb_disease_found BOOLEAN NOT NULL DEFAULT FALSE,
        outcome VARCHAR(30),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tb_ci_tb_patient ON tb_contact_investigations (tb_patient_id)`,
    ];
  }

  private getSprint78SdohModuleStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS community_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        address TEXT,
        phone TEXT,
        website TEXT,
        eligibility_criteria TEXT,
        languages TEXT[],
        availability TEXT,
        tenant_specific BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_comm_res_category ON community_resources (category)`,
      `CREATE INDEX IF NOT EXISTS idx_comm_res_active ON community_resources (is_active)`,
      `CREATE TABLE IF NOT EXISTS sdoh_referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        resource_id UUID NOT NULL,
        referral_date DATE NOT NULL,
        referral_reason TEXT NOT NULL,
        referred_by UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        outcome TEXT,
        follow_up_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sdoh_ref_patient ON sdoh_referrals (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sdoh_ref_status ON sdoh_referrals (status)`,
      `CREATE TABLE IF NOT EXISTS sdoh_screening_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        screening_date DATE NOT NULL,
        tool_used TEXT NOT NULL,
        responses JSONB NOT NULL DEFAULT '{}',
        positive_screens JSONB NOT NULL DEFAULT '[]',
        z_codes TEXT[],
        conducted_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sdoh_screen_patient ON sdoh_screening_logs (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sdoh_screen_date ON sdoh_screening_logs (screening_date)`,
    ];
  }

  private getSprint112P0SafetyStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS encryption_key_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_version VARCHAR(20) NOT NULL UNIQUE,
        activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deprecated_at TIMESTAMPTZ,
        is_current BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_enc_key_current ON encryption_key_versions (is_current)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_consents_type ON patient_consents (patient_id, consent_type, status)`,
      // Extend consent_type CHECK constraint to include cdss_ai_processing
      `ALTER TABLE consent_templates DROP CONSTRAINT IF EXISTS consent_templates_consent_type_check`,
      `ALTER TABLE consent_templates ADD CONSTRAINT consent_templates_consent_type_check
       CHECK (consent_type IN (
         'treatment','surgery','procedure','research','hipaa','photography',
         'release_of_information','financial','telehealth','vaccine',
         'anesthesia','blood_transfusion','general','cdss_ai_processing'
       ))`,
      // Seed the CDSS AI consent template (content column, not description; template_name + template_code required)
      `INSERT INTO consent_templates (consent_type, template_name, template_code, title, content, version, is_active, created_at, updated_at)
       VALUES (
         'cdss_ai_processing',
         'AI-Assisted Clinical Decision Support',
         'cdss_ai_processing_v1',
         'AI-Assisted Clinical Decision Support Consent',
         'Consent for use of AI/CDSS tools to analyze health information for care improvement. All AI recommendations are reviewed by a qualified clinician.',
         '1.0',
         true,
         NOW(),
         NOW()
       ) ON CONFLICT (template_code) DO NOTHING`,
    ];
  }

  private getSprint112FeedbackPersistenceStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS cdss_feedback_batches (
        batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100) NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        feedback_count INT NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_batch_tenant ON cdss_feedback_batches (tenant_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_batch_status ON cdss_feedback_batches (status, submitted_at DESC)`,
      `CREATE TABLE IF NOT EXISTS cdss_feedback_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL REFERENCES cdss_feedback_batches(batch_id) ON DELETE CASCADE,
        tenant_id VARCHAR(100) NOT NULL,
        log_id VARCHAR(255),
        patient_id UUID,
        decision_type VARCHAR(60) NOT NULL,
        top_recommendation TEXT,
        confidence_score NUMERIC(5,4),
        clinician_action VARCHAR(20),
        override_reason TEXT,
        outcome_at_30_days JSONB,
        outcome_at_90_days JSONB,
        feedback_status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
        review_notes TEXT,
        claimed_for_learning BOOLEAN NOT NULL DEFAULT FALSE,
        claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_batch ON cdss_feedback_entries (batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_tenant ON cdss_feedback_entries (tenant_id, feedback_status)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_decision ON cdss_feedback_entries (decision_type, clinician_action)`,
      `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_claim ON cdss_feedback_entries (claimed_for_learning, feedback_status)`,
    ];
  }

  private getSprint113UiCompletenessStatements(): string[] {
    return [
      `ALTER TABLE patient_early_warning_scores ADD COLUMN IF NOT EXISTS news2_components JSONB`,
      `ALTER TABLE patient_early_warning_scores ADD COLUMN IF NOT EXISTS deterioration_probability NUMERIC(5,4)`,
      `ALTER TABLE patient_early_warning_scores ADD COLUMN IF NOT EXISTS deterioration_risk_horizon INT`,
      `ALTER TABLE patient_early_warning_scores ADD COLUMN IF NOT EXISTS ml_interventions JSONB NOT NULL DEFAULT '[]'`,
      `ALTER TABLE patient_early_warning_scores ADD COLUMN IF NOT EXISTS ml_confidence NUMERIC(5,4)`,
      `ALTER TABLE patient_followup_orchestrations ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(30)`,
      `ALTER TABLE patient_followup_orchestrations ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`,
      `ALTER TABLE patient_followup_orchestrations ADD COLUMN IF NOT EXISTS checklist_items JSONB NOT NULL DEFAULT '[]'`,
      `CREATE INDEX IF NOT EXISTS idx_pfo_resolution ON patient_followup_orchestrations (resolution_status, resolved_at DESC)`,
    ];
  }

  private getSprint114ClinicalRagStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS vector`,

      `CREATE TABLE IF NOT EXISTS clinical_knowledge_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        specialty VARCHAR(100),
        source_organization VARCHAR(255),
        version VARCHAR(50),
        effective_date DATE,
        expiry_date DATE,
        language VARCHAR(10) NOT NULL DEFAULT 'en',
        minio_bucket VARCHAR(100) NOT NULL,
        minio_key TEXT NOT NULL,
        file_size_bytes INT,
        mime_type VARCHAR(100),
        chunk_count INT NOT NULL DEFAULT 0,
        embedding_model VARCHAR(100),
        ingestion_status VARCHAR(30) NOT NULL DEFAULT 'pending',
        ingestion_error TEXT,
        ingested_at TIMESTAMPTZ,
        uploaded_by UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ckd_tenant ON clinical_knowledge_documents (tenant_id, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_ckd_type ON clinical_knowledge_documents (document_type, specialty)`,
      `CREATE INDEX IF NOT EXISTS idx_ckd_status ON clinical_knowledge_documents (ingestion_status)`,

      `CREATE TABLE IF NOT EXISTS clinical_knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES clinical_knowledge_documents(id) ON DELETE CASCADE,
        tenant_id VARCHAR(100) NOT NULL,
        chunk_index INT NOT NULL,
        chunk_text TEXT NOT NULL,
        chunk_tokens INT NOT NULL,
        embedding vector(384),
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ckc_document ON clinical_knowledge_chunks (document_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ckc_tenant ON clinical_knowledge_chunks (tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ckc_embedding ON clinical_knowledge_chunks
       USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)`,

      `CREATE TABLE IF NOT EXISTS rag_search_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100) NOT NULL,
        query_text TEXT NOT NULL,
        query_embedding_model VARCHAR(100),
        surface VARCHAR(100),
        patient_id UUID,
        top_chunk_ids UUID[],
        retrieval_latency_ms INT,
        chunks_returned INT,
        user_clicked_citation BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_rsl_tenant ON rag_search_logs (tenant_id, created_at DESC)`,
    ];
  }

  private getSprint115DenialPredictionStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS claim_risk_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        encounter_id UUID,
        risk_score DECIMAL(5,4) NOT NULL,
        confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
        top_reasons JSONB NOT NULL DEFAULT '[]',
        model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
        feature_snapshot JSONB NOT NULL DEFAULT '{}',
        threshold_action VARCHAR(20) NOT NULL DEFAULT 'allow',
        override_reason TEXT,
        override_user_id UUID,
        actual_outcome VARCHAR(30),
        feedback_recorded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_claim_id ON claim_risk_scores(claim_id)`,
      `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_patient_id ON claim_risk_scores(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_risk_score ON claim_risk_scores(risk_score DESC)`,

      `CREATE TABLE IF NOT EXISTS claim_appeals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        denial_reason_code VARCHAR(50) NOT NULL,
        denial_reason_description TEXT NOT NULL,
        draft_letter TEXT NOT NULL,
        rag_sources JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        submitted_at TIMESTAMPTZ,
        outcome_at TIMESTAMPTZ,
        outcome_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_claim_appeals_claim_id ON claim_appeals(claim_id)`,

      `CREATE TABLE IF NOT EXISTS financial_hardship_referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        claim_id UUID,
        trigger_reason VARCHAR(100) NOT NULL,
        household_size INT,
        estimated_income_band VARCHAR(30),
        programs_matched JSONB NOT NULL DEFAULT '[]',
        assigned_to_user_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        ai_recommendation TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_financial_hardship_patient_id ON financial_hardship_referrals(patient_id)`,

      `CREATE TABLE IF NOT EXISTS pdmp_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        prescriber_id UUID NOT NULL,
        drug_name VARCHAR(200) NOT NULL,
        dea_schedule VARCHAR(10),
        morphine_milligram_equivalent DECIMAL(8,2),
        risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
        prescriber_alerts JSONB NOT NULL DEFAULT '[]',
        other_active_prescriptions JSONB NOT NULL DEFAULT '[]',
        dispensing_blocked BOOLEAN NOT NULL DEFAULT FALSE,
        block_override_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pdmp_checks_patient_id ON pdmp_checks(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pdmp_checks_risk_level ON pdmp_checks(risk_level)`,
    ];
  }

  private getSprint116RiskStratSelfLearningStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_risk_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tier VARCHAR(20) NOT NULL DEFAULT 'minimal',
        composite_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        chronic_condition_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        vitals_trend_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        adherence_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        sdoh_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        no_show_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
        lab_trend_score DECIMAL(5,4) NOT NULL DEFAULT 0,
        contributing_factors JSONB NOT NULL DEFAULT '[]',
        recommended_actions JSONB NOT NULL DEFAULT '[]',
        model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
        batch_run_id UUID,
        valid_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_patient_id ON patient_risk_tiers(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_tier ON patient_risk_tiers(tier)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_composite ON patient_risk_tiers(composite_score DESC)`,

      `CREATE TABLE IF NOT EXISTS risk_stratification_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100) NOT NULL,
        total_patients INT NOT NULL DEFAULT 0,
        processed_patients INT NOT NULL DEFAULT 0,
        critical_count INT NOT NULL DEFAULT 0,
        high_count INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        error_log TEXT,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS model_deployments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surface VARCHAR(100) NOT NULL,
        model_version VARCHAR(50) NOT NULL,
        previous_version VARCHAR(50),
        eval_run_id UUID NOT NULL,
        release_gate_id UUID NOT NULL,
        accuracy_before DECIMAL(5,4),
        accuracy_after DECIMAL(5,4),
        deployed_by_user_id UUID,
        deployment_method VARCHAR(50) NOT NULL DEFAULT 'auto',
        status VARCHAR(20) NOT NULL DEFAULT 'deployed',
        rollback_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_model_deployments_surface ON model_deployments(surface)`,

      `CREATE TABLE IF NOT EXISTS ai_ops_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        surface VARCHAR(100) NOT NULL,
        metric_date DATE NOT NULL,
        total_calls INT NOT NULL DEFAULT 0,
        abstention_count INT NOT NULL DEFAULT 0,
        circuit_breaker_trips INT NOT NULL DEFAULT 0,
        avg_latency_ms DECIMAL(8,2),
        p95_latency_ms DECIMAL(8,2),
        accuracy DECIMAL(5,4),
        fairness_age_parity DECIMAL(5,4),
        fairness_gender_parity DECIMAL(5,4),
        fairness_sdoh_parity DECIMAL(5,4),
        consent_block_count INT NOT NULL DEFAULT 0,
        override_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(surface, metric_date)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_ops_metrics_surface_date ON ai_ops_metrics(surface, metric_date DESC)`,
    ];
  }

  private getSprint126SchedulerSchemaFixStatements(): string[] {
    return [
      // oncology_adverse_events: tracking columns needed by background escalation job
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS severity_grade INTEGER`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50)`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`,
      `ALTER TABLE oncology_adverse_events ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE`,
      // oncology_regimens: cycle-tracking columns needed by background reminder job
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS cycle_length_days INTEGER`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 0`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS last_cycle_date DATE`,
      `ALTER TABLE oncology_regimens ADD COLUMN IF NOT EXISTS next_cycle_date DATE`,
      // cardiology_encounters: follow-up tracking columns needed by SLA job
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false`,
      `ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS follow_up_date DATE`,
    ];
  }

  private getSprint117RegistrationAiStatements(): string[] {
    return [
      `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
      `CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`,

      `CREATE TABLE IF NOT EXISTS registration_ai_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID,
        session_token VARCHAR(100) NOT NULL UNIQUE,
        phonetic_matches_found INT NOT NULL DEFAULT 0,
        duplicate_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        ocr_attempted BOOLEAN NOT NULL DEFAULT FALSE,
        ocr_success BOOLEAN NOT NULL DEFAULT FALSE,
        ocr_fields_accepted JSONB NOT NULL DEFAULT '[]',
        sdoh_screening_completed BOOLEAN NOT NULL DEFAULT FALSE,
        sdoh_screening_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_reg_ai_sessions_patient_id ON registration_ai_sessions(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reg_ai_sessions_token ON registration_ai_sessions(session_token)`,

      `CREATE TABLE IF NOT EXISTS insurance_ocr_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID,
        session_token VARCHAR(100) NOT NULL,
        minio_object_key VARCHAR(500) NOT NULL,
        member_id VARCHAR(100),
        group_number VARCHAR(100),
        plan_name VARCHAR(200),
        payer_name VARCHAR(200),
        effective_date VARCHAR(20),
        expiry_date VARCHAR(20),
        raw_ocr_json JSONB NOT NULL DEFAULT '{}',
        confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
        manually_corrected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_insurance_ocr_patient_id ON insurance_ocr_results(patient_id)`,

      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'patients' AND column_name = 'first_name'
         ) THEN
           EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_trgm_first ON patients USING gin(first_name gin_trgm_ops)';
           EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_trgm_last ON patients USING gin(last_name gin_trgm_ops)';
         END IF;
       END $$`,
    ];
  }

  private getSprint117RadiologyViewerStatements(): string[] {
    return [
      `ALTER TABLE radiology_report_drafts
       ADD COLUMN IF NOT EXISTS heatmap_regions JSONB NOT NULL DEFAULT '[]'`,

      `ALTER TABLE radiology_report_drafts
       ADD COLUMN IF NOT EXISTS dicom_study_uid VARCHAR(200)`,

      `ALTER TABLE radiology_report_drafts
       ADD COLUMN IF NOT EXISTS dicom_series_uid VARCHAR(200)`,

      `CREATE TABLE IF NOT EXISTS dicom_series (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imaging_order_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        study_instance_uid VARCHAR(200) NOT NULL,
        series_instance_uid VARCHAR(200) NOT NULL,
        modality VARCHAR(20) NOT NULL DEFAULT 'CT',
        series_description TEXT,
        instance_count INT NOT NULL DEFAULT 0,
        minio_prefix VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_dicom_series_order_id ON dicom_series(imaging_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_dicom_series_study_uid ON dicom_series(study_instance_uid)`,
    ];
  }

  private getSprint127ProactiveAiStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS patient_ai_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tenant_id VARCHAR(100) NOT NULL,
        clinical_summary TEXT,
        analysis_payload JSONB NOT NULL DEFAULT '{}',
        risk_scores JSONB NOT NULL DEFAULT '{}',
        active_flags JSONB NOT NULL DEFAULT '[]',
        guideline_citations TEXT,
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
        news2_score INT,
        qsofa_score INT,
        model_version VARCHAR(100),
        snapshot_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        triggered_by_user_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_patient_ai_snapshot_patient UNIQUE (patient_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_snapshots_patient ON patient_ai_snapshots (patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_ai_snapshots_tenant ON patient_ai_snapshots (tenant_id, snapshot_generated_at DESC)`,

      `CREATE TABLE IF NOT EXISTS proactive_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tenant_id VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'clinical_alert',
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        title VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        recommended_action TEXT,
        guideline_reference TEXT,
        trigger_type VARCHAR(50),
        dedup_key VARCHAR(64),
        expires_at TIMESTAMPTZ,
        target_user_id UUID,
        acknowledged_by UUID,
        acknowledged_at TIMESTAMPTZ,
        dismissed_by UUID,
        dismissed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_proactive_alerts_patient_status ON proactive_alerts (patient_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_proactive_alerts_tenant_status ON proactive_alerts (tenant_id, status, severity)`,
      `CREATE INDEX IF NOT EXISTS idx_proactive_alerts_target_user ON proactive_alerts (target_user_id, status)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_alerts_dedup ON proactive_alerts (dedup_key) WHERE status = 'active' AND dedup_key IS NOT NULL`,

      `CREATE TABLE IF NOT EXISTS patient_risk_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tenant_id VARCHAR(100) NOT NULL,
        score_type VARCHAR(50) NOT NULL,
        score_value NUMERIC(6,4) NOT NULL,
        risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
        scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trigger_type VARCHAR(50),
        model_version VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_risk_scores_patient ON patient_risk_scores (patient_id, scored_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_risk_scores_tenant ON patient_risk_scores (tenant_id, score_type)`,
    ];
  }

  private getSprint127ProactiveAiColumnHardeningStatements(): string[] {
    return [
      // Rename acknowledged_by → acknowledged_by_id (entity uses acknowledged_by_id)
      `DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'proactive_alerts' AND column_name = 'acknowledged_by'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'proactive_alerts' AND column_name = 'acknowledged_by_id'
        ) THEN
          ALTER TABLE proactive_alerts RENAME COLUMN acknowledged_by TO acknowledged_by_id;
        END IF;
      END $$`,

      // proactive_alerts: add missing columns
      `ALTER TABLE proactive_alerts ADD COLUMN IF NOT EXISTS trigger_data JSONB`,
      `ALTER TABLE proactive_alerts ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4)`,
      `ALTER TABLE proactive_alerts ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE proactive_alerts ADD COLUMN IF NOT EXISTS snapshot_id UUID`,
      // ensure acknowledged_by_id exists if rename above was skipped (fresh DB case)
      `ALTER TABLE proactive_alerts ADD COLUMN IF NOT EXISTS acknowledged_by_id UUID`,

      // patient_risk_scores: add missing columns
      `ALTER TABLE patient_risk_scores ADD COLUMN IF NOT EXISTS input_data JSONB`,
      `ALTER TABLE patient_risk_scores ADD COLUMN IF NOT EXISTS snapshot_id UUID`,
    ];
  }
}
