/**
 * ICD-10 to SNOMED CT Mapping Import Script
 * 
 * This script imports ICD-10 mapping data directly into PostgreSQL master database,
 * making it shared across all tenants (like SNOMED CT).
 * 
 * Usage:
 *   ts-node scripts/import-icd10-mappings-to-postgresql.ts <tsv-file-path>
 * 
 * Example:
 *   ts-node scripts/import-icd10-mappings-to-postgresql.ts snowstorm/import/SNOMED_CT_to_ICD-10-CM_Resources_20250901/tls_Icd10cmHumanReadableMap_US1000124_20250901.tsv
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface ICD10Mapping {
  conceptId: string;
  conceptFsn: string;
  targetCode: string;
  targetDisplay: string;
  mapGroup: number;
  mapPriority: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  mapCategoryId?: string;
  moduleId?: string;
  effectiveTime?: string;
  active: boolean;
  mapSource?: string;
}

class ICD10PostgresImporter {
  private db: DataSource;
  private tsvPath: string;
  private batchSize = 10000;
  private stats = {
    mappings: 0,
    errors: 0,
  };

  constructor(tsvPath: string) {
    this.tsvPath = tsvPath;
    this.db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master',
    });
  }

  async initialize() {
    await this.db.initialize();
    await this.createSchema();
  }

  async createSchema() {
    console.log('📋 Creating ICD-10 mapping PostgreSQL schema in master database...');

    const schema = `
      -- Drop existing tables if they exist
      DROP TABLE IF EXISTS icd10_mapping_metadata CASCADE;
      DROP TABLE IF EXISTS snomed_icd10_mappings CASCADE;

      -- ICD-10 Mapping table (shared across all tenants)
      CREATE TABLE snomed_icd10_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Metadata table
      CREATE TABLE icd10_mapping_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        release_label VARCHAR(150) NOT NULL,
        effective_time DATE,
        source_zip TEXT,
        total_rows INTEGER,
        import_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        import_completed_at TIMESTAMP WITH TIME ZONE,
        notes TEXT
      );

      -- Indexes for performance
      CREATE UNIQUE INDEX idx_snomed_icd10_unique_map
        ON snomed_icd10_mappings (concept_id, target_code, map_group, map_priority);
      CREATE INDEX idx_snomed_icd10_concept
        ON snomed_icd10_mappings (concept_id);
      CREATE INDEX idx_snomed_icd10_target
        ON snomed_icd10_mappings (target_code);
      CREATE INDEX idx_snomed_icd10_active_concept
        ON snomed_icd10_mappings (active, concept_id);
      CREATE UNIQUE INDEX idx_icd10_mapping_metadata_release
        ON icd10_mapping_metadata (release_label);
    `;

    await this.db.query(schema);
    console.log('✅ Schema created successfully');
  }

  async importMappings(tsvPath: string) {
    console.log('📥 Importing ICD-10 mappings...');
    
    if (!fs.existsSync(tsvPath)) {
      throw new Error(`TSV file not found: ${tsvPath}`);
    }

    const fileStream = fs.createReadStream(tsvPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch: ICD10Mapping[] = [];
    let lineCount = 0;
    let header: string[] = [];

    for await (const line of rl) {
      if (lineCount === 0) {
        // Parse header
        header = line.split('\t').map(h => h.trim());
        lineCount++;
        continue;
      }

      const values = line.split('\t');
      
      // Map TSV columns to our structure
      // TSV columns: id, effectiveTime, active, moduleId, refsetId, referencedComponentId, referencedComponentName, 
      //              mapGroup, mapPriority, mapRule, mapAdvice, mapTarget, mapTargetName, correlationId, mapCategoryId, mapCategoryName
      const mapping: ICD10Mapping = {
        conceptId: values[5]?.trim() || '', // referencedComponentId
        conceptFsn: values[6]?.trim() || '', // referencedComponentName
        targetCode: values[11]?.trim() || '', // mapTarget
        targetDisplay: values[12]?.trim() || '', // mapTargetName
        mapGroup: parseInt(values[7] || '1', 10) || 1,
        mapPriority: parseInt(values[8] || '1', 10) || 1,
        mapRule: values[9]?.trim() || undefined,
        mapAdvice: values[10]?.trim() || undefined,
        mapStatus: values[14]?.trim() || undefined, // mapCategoryName (used as status)
        mapCategoryId: values[14]?.trim() || undefined, // mapCategoryId
        moduleId: values[3]?.trim() || undefined,
        effectiveTime: values[1]?.trim() ? 
          `${values[1].trim().substring(0, 4)}-${values[1].trim().substring(4, 6)}-${values[1].trim().substring(6, 8)}` : 
          undefined, // effectiveTime (convert YYYYMMDD to YYYY-MM-DD)
        active: values[2]?.trim() === '1' || values[2]?.trim().toLowerCase() === 'true',
        mapSource: 'SNOMED_CT_to_ICD-10-CM',
      };

      // Filter out invalid rows
      if (!mapping.conceptId || !mapping.targetCode) {
        this.stats.errors++;
        continue;
      }

      batch.push(mapping);

      if (batch.length >= this.batchSize) {
        await this.insertMappingsBatch(batch);
        batch = [];
      }
      lineCount++;
    }

    if (batch.length > 0) {
      await this.insertMappingsBatch(batch);
    }

    // Record metadata
    await this.recordMetadata(tsvPath, lineCount - 1);

    console.log(`\n✅ Imported ${this.stats.mappings} ICD-10 mappings`);
    if (this.stats.errors > 0) {
      console.log(`⚠️  Skipped ${this.stats.errors} invalid rows`);
    }
  }

  async insertMappingsBatch(batch: ICD10Mapping[]) {
    // Use parameterized queries for safety
    const query = `
      INSERT INTO snomed_icd10_mappings (
        concept_id, concept_fsn, target_code, target_display,
        map_group, map_priority, map_rule, map_advice, map_status,
        map_category_id, module_id, effective_time, active, map_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (concept_id, target_code, map_group, map_priority) DO UPDATE SET
        concept_fsn = EXCLUDED.concept_fsn,
        target_display = EXCLUDED.target_display,
        map_rule = EXCLUDED.map_rule,
        map_advice = EXCLUDED.map_advice,
        map_status = EXCLUDED.map_status,
        map_category_id = EXCLUDED.map_category_id,
        effective_time = EXCLUDED.effective_time,
        active = EXCLUDED.active,
        updated_at = NOW()
    `;

    // Insert in smaller chunks to avoid parameter limit
    const chunkSize = 100;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(m =>
          this.db.query(query, [
            m.conceptId,
            m.conceptFsn || undefined,
            m.targetCode,
            m.targetDisplay || undefined,
            m.mapGroup,
            m.mapPriority,
            m.mapRule || undefined,
            m.mapAdvice || undefined,
            m.mapStatus || undefined,
            m.mapCategoryId || undefined,
            m.moduleId || undefined,
            m.effectiveTime || undefined,
            m.active,
            m.mapSource || undefined,
          ])
        )
      );
    }

    this.stats.mappings += batch.length;
    process.stdout.write(`\r  Mappings: ${this.stats.mappings}`);
  }

  async recordMetadata(tsvPath: string, totalRows: number) {
    const fileName = path.basename(tsvPath);
    // Extract release label from filename: tls_Icd10cmHumanReadableMap_US1000124_20250901.tsv
    const releaseMatch = fileName.match(/US(\d+)_(\d{8})/);
    const releaseLabel = releaseMatch ? `US${releaseMatch[1]}_${releaseMatch[2]}` : fileName;
    const effectiveTime = releaseMatch?.[2] || null;

    await this.db.query(
      `
      INSERT INTO icd10_mapping_metadata (
        release_label, effective_time, source_zip, total_rows, import_completed_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (release_label) DO UPDATE SET
        total_rows = EXCLUDED.total_rows,
        import_completed_at = NOW()
    `,
      [
        releaseLabel,
        effectiveTime ? `${effectiveTime.substring(0, 4)}-${effectiveTime.substring(4, 6)}-${effectiveTime.substring(6, 8)}` : null,
        tsvPath,
        totalRows,
      ]
    );
  }

  async close() {
    await this.db.destroy();
  }
}

// Main execution
async function main() {
  const tsvPath = process.argv[2] || process.env.ICD10_TSV_PATH;
  
  if (!tsvPath) {
    console.error('❌ Error: Please provide TSV file path');
    console.error('Usage: ts-node scripts/import-icd10-mappings-to-postgresql.ts <tsv-file-path>');
    process.exit(1);
  }

  if (!fs.existsSync(tsvPath)) {
    console.error(`❌ Error: TSV file not found: ${tsvPath}`);
    process.exit(1);
  }

  const importer = new ICD10PostgresImporter(tsvPath);
  
  try {
    console.log('🚀 Starting ICD-10 mapping PostgreSQL import...');
    console.log(`📁 TSV Path: ${tsvPath}`);
    
    await importer.initialize();
    await importer.importMappings(tsvPath);
    
    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   Mappings: ${importer['stats'].mappings}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

// Run main if this file is executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

