/**
 * SNOMED CT RF2 to PostgreSQL Direct Import Script
 * 
 * This script imports SNOMED CT RF2 files directly into PostgreSQL,
 * eliminating the need for Snowstorm + Elasticsearch.
 * 
 * Usage:
 *   ts-node scripts/import-snomed-to-postgresql.ts <rf2-directory>
 * 
 * Example:
 *   ts-node scripts/import-snomed-to-postgresql.ts ~/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface RF2Concept {
  conceptId: string;
  effectiveTime: string;
  active: boolean;
  moduleId: string;
  definitionStatusId: string;
}

interface RF2Description {
  descriptionId: string;
  effectiveTime: string;
  active: boolean;
  moduleId: string;
  conceptId: string;
  languageCode: string;
  typeId: string; // 900000000000003001 = FSN, 900000000000013009 = Synonym
  term: string;
  caseSignificanceId: string;
}

interface RF2Relationship {
  relationshipId: string;
  effectiveTime: string;
  active: boolean;
  moduleId: string;
  sourceId: string;
  destinationId: string;
  relationshipGroup: number;
  typeId: string;
  characteristicTypeId: string;
  modifierId: string;
}

class SnomedPostgresImporter {
  private db: DataSource;
  private rf2Path: string;
  private batchSize = 10000;
  private stats = {
    concepts: 0,
    descriptions: 0,
    relationships: 0,
    errors: 0,
  };

  constructor(rf2Path: string) {
    this.rf2Path = rf2Path;
    this.db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master', // We'll create a shared SNOMED database or use master
    });
  }

  async initialize() {
    await this.db.initialize();
    await this.createSchema();
  }

  async createSchema() {
    console.log('📋 Creating SNOMED CT PostgreSQL schema...');

    const schema = `
      -- Drop existing tables if they exist
      DROP TABLE IF EXISTS snomed_relationships CASCADE;
      DROP TABLE IF EXISTS snomed_descriptions CASCADE;
      DROP TABLE IF EXISTS snomed_concepts CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS snomed_search_view CASCADE;

      -- Core SNOMED CT Concept table
      CREATE TABLE snomed_concepts (
        concept_id VARCHAR(18) PRIMARY KEY,
        effective_time DATE NOT NULL,
        active BOOLEAN NOT NULL,
        module_id VARCHAR(18) NOT NULL,
        definition_status_id VARCHAR(18) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- SNOMED CT Description table (terms/synonyms)
      CREATE TABLE snomed_descriptions (
        description_id VARCHAR(18) PRIMARY KEY,
        effective_time DATE NOT NULL,
        active BOOLEAN NOT NULL,
        module_id VARCHAR(18) NOT NULL,
        concept_id VARCHAR(18) NOT NULL,
        language_code VARCHAR(2) NOT NULL DEFAULT 'en',
        type_id VARCHAR(18) NOT NULL,
        term TEXT NOT NULL,
        case_significance_id VARCHAR(18) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (concept_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE
      );

      -- SNOMED CT Relationship table (hierarchies)
      CREATE TABLE snomed_relationships (
        relationship_id VARCHAR(18) PRIMARY KEY,
        effective_time DATE NOT NULL,
        active BOOLEAN NOT NULL,
        module_id VARCHAR(18) NOT NULL,
        source_id VARCHAR(18) NOT NULL,
        destination_id VARCHAR(18) NOT NULL,
        relationship_group INTEGER NOT NULL,
        type_id VARCHAR(18) NOT NULL,
        characteristic_type_id VARCHAR(18) NOT NULL,
        modifier_id VARCHAR(18) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (source_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE,
        FOREIGN KEY (destination_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX idx_snomed_concepts_active ON snomed_concepts(active) WHERE active = true;
      CREATE INDEX idx_snomed_descriptions_concept_id ON snomed_descriptions(concept_id);
      CREATE INDEX idx_snomed_descriptions_active ON snomed_descriptions(active) WHERE active = true;
      CREATE INDEX idx_snomed_descriptions_language ON snomed_descriptions(language_code) WHERE language_code = 'en';
      CREATE INDEX idx_snomed_descriptions_type_id ON snomed_descriptions(type_id);
      CREATE INDEX idx_snomed_relationships_source ON snomed_relationships(source_id);
      CREATE INDEX idx_snomed_relationships_destination ON snomed_relationships(destination_id);
      CREATE INDEX idx_snomed_relationships_active ON snomed_relationships(active) WHERE active = true;

      -- Full-text search index on descriptions
      CREATE INDEX idx_snomed_descriptions_term_fts ON snomed_descriptions USING gin(to_tsvector('english', term));

      -- Materialized view for fast search (refreshed after import)
      CREATE MATERIALIZED VIEW snomed_search_view AS
      SELECT 
        c.concept_id,
        c.active,
        d.description_id,
        d.term,
        d.type_id,
        CASE 
          WHEN d.type_id = '900000000000003001' THEN 'FSN'
          WHEN d.type_id = '900000000000013009' THEN 'Synonym'
          ELSE 'Other'
        END as term_type,
        to_tsvector('english', d.term) as search_vector
      FROM snomed_concepts c
      JOIN snomed_descriptions d ON c.concept_id = d.concept_id
      WHERE c.active = true 
        AND d.active = true 
        AND d.language_code = 'en'
        AND NOT c.concept_id LIKE '999%'; -- Filter out test concepts

      -- Index on materialized view
      CREATE INDEX idx_snomed_search_view_vector ON snomed_search_view USING gin(search_vector);
      CREATE INDEX idx_snomed_search_view_term ON snomed_search_view(term);
      CREATE INDEX idx_snomed_search_view_concept_id ON snomed_search_view(concept_id);
    `;

    await this.db.query(schema);
    console.log('✅ Schema created successfully');
  }

  async importConcepts(snapshotPath: string) {
    console.log('📥 Importing concepts...');
    // snapshotPath is already Snapshot/Terminology, so use it directly
    const terminologyPath = snapshotPath;
    if (!fs.existsSync(terminologyPath)) {
      throw new Error(`Terminology directory not found: ${terminologyPath}`);
    }
    
    const files = fs.readdirSync(terminologyPath).filter(f => f.startsWith('sct2_Concept_Snapshot_'));
    
    if (files.length === 0) {
      throw new Error(`No concept snapshot file found in ${terminologyPath}`);
    }

    const fullPath = path.join(terminologyPath, files[0]);
    const fileStream = fs.createReadStream(fullPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch: RF2Concept[] = [];
    let lineCount = 0;

    for await (const line of rl) {
      if (lineCount === 0) {
        lineCount++;
        continue; // Skip header
      }

      const [id, effectiveTime, active, moduleId, definitionStatusId] = line.split('\t');
      
      // Filter out test concepts
      if (id && id.startsWith('999')) continue;

      batch.push({
        conceptId: id,
        effectiveTime,
        active: active === '1',
        moduleId,
        definitionStatusId,
      });

      if (batch.length >= this.batchSize) {
        await this.insertConceptsBatch(batch);
        batch = [];
      }
      lineCount++;
    }

    if (batch.length > 0) {
      await this.insertConceptsBatch(batch);
    }

    console.log(`✅ Imported ${this.stats.concepts} concepts`);
  }

  async insertConceptsBatch(batch: RF2Concept[]) {
    // Use parameterized queries for safety
    const query = `
      INSERT INTO snomed_concepts (concept_id, effective_time, active, module_id, definition_status_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (concept_id) DO UPDATE SET
        effective_time = EXCLUDED.effective_time,
        active = EXCLUDED.active,
        module_id = EXCLUDED.module_id,
        definition_status_id = EXCLUDED.definition_status_id
    `;

    // Insert in smaller chunks to avoid parameter limit
    const chunkSize = 100;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(c =>
          this.db.query(query, [
            c.conceptId,
            c.effectiveTime,
            c.active,
            c.moduleId,
            c.definitionStatusId,
          ])
        )
      );
    }

    this.stats.concepts += batch.length;
    process.stdout.write(`\r  Concepts: ${this.stats.concepts}`);
  }

  async importDescriptions(snapshotPath: string) {
    console.log('\n📥 Importing descriptions...');
    // snapshotPath is already Snapshot/Terminology, so use it directly
    const terminologyPath = snapshotPath;
    if (!fs.existsSync(terminologyPath)) {
      throw new Error(`Terminology directory not found: ${terminologyPath}`);
    }
    
    const files = fs.readdirSync(terminologyPath).filter(f => 
      f.startsWith('sct2_Description_Snapshot') && (f.includes('en') || f.includes('EN'))
    );
    
    if (files.length === 0) {
      throw new Error(`No English description snapshot file found in ${terminologyPath}`);
    }

    const fullPath = path.join(terminologyPath, files[0]);
    const fileStream = fs.createReadStream(fullPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch: RF2Description[] = [];
    let lineCount = 0;

    for await (const line of rl) {
      if (lineCount === 0) {
        lineCount++;
        continue; // Skip header
      }

      const [id, effectiveTime, active, moduleId, conceptId, languageCode, typeId, term, caseSignificanceId] = line.split('\t');
      
      // Filter out test concepts
      if (conceptId && conceptId.startsWith('999')) continue;

      batch.push({
        descriptionId: id,
        effectiveTime,
        active: active === '1',
        moduleId,
        conceptId,
        languageCode,
        typeId,
        term,
        caseSignificanceId,
      });

      if (batch.length >= this.batchSize) {
        await this.insertDescriptionsBatch(batch);
        batch = [];
      }
      lineCount++;
    }

    if (batch.length > 0) {
      await this.insertDescriptionsBatch(batch);
    }

    console.log(`\n✅ Imported ${this.stats.descriptions} descriptions`);
  }

  async insertDescriptionsBatch(batch: RF2Description[]) {
    // Use parameterized queries for safety
    const query = `
      INSERT INTO snomed_descriptions (
        description_id, effective_time, active, module_id, concept_id, 
        language_code, type_id, term, case_significance_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (description_id) DO UPDATE SET
        effective_time = EXCLUDED.effective_time,
        active = EXCLUDED.active,
        term = EXCLUDED.term
    `;

    // Insert in smaller chunks to avoid parameter limit
    const chunkSize = 100;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(d =>
          this.db.query(query, [
            d.descriptionId,
            d.effectiveTime,
            d.active,
            d.moduleId,
            d.conceptId,
            d.languageCode,
            d.typeId,
            d.term,
            d.caseSignificanceId,
          ])
        )
      );
    }

    this.stats.descriptions += batch.length;
    process.stdout.write(`\r  Descriptions: ${this.stats.descriptions}`);
  }

  async refreshSearchView() {
    console.log('\n🔄 Refreshing search materialized view...');
    // First, create a unique index if it doesn't exist (required for CONCURRENT refresh)
    try {
      await this.db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snomed_search_view_unique 
        ON snomed_search_view(description_id)
      `);
    } catch (error: any) {
      // Index might already exist, continue
      console.log(`   Index creation note: ${error.message}`);
    }
    
    // Try concurrent refresh first, fall back to regular refresh
    try {
      await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY snomed_search_view');
      console.log('✅ Search view refreshed (concurrent)');
    } catch (error: any) {
      // Fall back to regular refresh if concurrent fails
      console.log('   Using regular refresh (concurrent requires unique index)...');
      await this.db.query('REFRESH MATERIALIZED VIEW snomed_search_view');
      console.log('✅ Search view refreshed');
    }
  }

  async close() {
    await this.db.destroy();
  }
}

// Main execution
async function main() {
  const rf2Path = process.argv[2] || process.env.SNOMED_RF2_PATH;
  
  if (!rf2Path) {
    console.error('❌ Error: Please provide RF2 directory path');
    console.error('Usage: ts-node scripts/import-snomed-to-postgresql.ts <rf2-directory>');
    process.exit(1);
  }

  if (!fs.existsSync(rf2Path)) {
    console.error(`❌ Error: RF2 directory not found: ${rf2Path}`);
    process.exit(1);
  }

  // Check for both possible structures: Snapshot/Terminology or just Terminology
  let snapshotPath = path.join(rf2Path, 'Snapshot', 'Terminology');
  if (!fs.existsSync(snapshotPath)) {
    snapshotPath = path.join(rf2Path, 'Terminology');
    if (!fs.existsSync(snapshotPath)) {
      console.error(`❌ Error: Snapshot/Terminology directory not found in: ${rf2Path}`);
      console.error(`   Tried: ${path.join(rf2Path, 'Snapshot', 'Terminology')}`);
      console.error(`   Tried: ${path.join(rf2Path, 'Terminology')}`);
      process.exit(1);
    }
  }

  const importer = new SnomedPostgresImporter(rf2Path);
  
  try {
    console.log('🚀 Starting SNOMED CT PostgreSQL import...');
    console.log(`📁 RF2 Path: ${rf2Path}`);
    console.log(`📁 Snapshot Path: ${snapshotPath}`);
    
    await importer.initialize();
    await importer.importConcepts(snapshotPath);
    await importer.importDescriptions(snapshotPath);
    await importer.refreshSearchView();
    
    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   Concepts: ${importer['stats'].concepts}`);
    console.log(`   Descriptions: ${importer['stats'].descriptions}`);
    
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

