#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * ICD-10-CM Full Database Import Script
 * 
 * Imports official ICD-10-CM 2026 codes from CMS data files
 * Source: downloads/icd10cm-codes-2026.txt (74,719 codes)
 * 
 * Format: CODE<TAB>DESCRIPTION
 * Example: A000<TAB>Cholera due to Vibrio cholerae 01, biovar cholerae
 */

const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tenant_bulawayo_general',
  user: process.env.DB_USER || 'medicore',
  password: process.env.DB_PASSWORD || 'medicore_password',
});

// ICD-10 chapter categories
const CHAPTERS = {
  'A': { start: 'A00', end: 'B99', category: 'Infectious and parasitic diseases' },
  'B': { start: 'A00', end: 'B99', category: 'Infectious and parasitic diseases' },
  'C': { start: 'C00', end: 'D49', category: 'Neoplasms' },
  'D0': { start: 'C00', end: 'D49', category: 'Neoplasms' },
  'D5': { start: 'D50', end: 'D89', category: 'Diseases of blood and blood-forming organs' },
  'E': { start: 'E00', end: 'E89', category: 'Endocrine, nutritional and metabolic diseases' },
  'F': { start: 'F01', end: 'F99', category: 'Mental, behavioral and neurodevelopmental disorders' },
  'G': { start: 'G00', end: 'G99', category: 'Diseases of the nervous system' },
  'H0': { start: 'H00', end: 'H59', category: 'Diseases of the eye and adnexa' },
  'H6': { start: 'H60', end: 'H95', category: 'Diseases of the ear and mastoid process' },
  'I': { start: 'I00', end: 'I99', category: 'Diseases of the circulatory system' },
  'J': { start: 'J00', end: 'J99', category: 'Diseases of the respiratory system' },
  'K': { start: 'K00', end: 'K95', category: 'Diseases of the digestive system' },
  'L': { start: 'L00', end: 'L99', category: 'Diseases of the skin and subcutaneous tissue' },
  'M': { start: 'M00', end: 'M99', category: 'Diseases of the musculoskeletal system' },
  'N': { start: 'N00', end: 'N99', category: 'Diseases of the genitourinary system' },
  'O': { start: 'O00', end: 'O9A', category: 'Pregnancy, childbirth and the puerperium' },
  'P': { start: 'P00', end: 'P96', category: 'Perinatal conditions' },
  'Q': { start: 'Q00', end: 'Q99', category: 'Congenital malformations' },
  'R': { start: 'R00', end: 'R99', category: 'Symptoms, signs and abnormal findings' },
  'S': { start: 'S00', end: 'T88', category: 'Injury, poisoning and external causes' },
  'T': { start: 'S00', end: 'T88', category: 'Injury, poisoning and external causes' },
  'V': { start: 'V00', end: 'Y99', category: 'External causes of morbidity' },
  'W': { start: 'V00', end: 'Y99', category: 'External causes of morbidity' },
  'X': { start: 'V00', end: 'Y99', category: 'External causes of morbidity' },
  'Y': { start: 'V00', end: 'Y99', category: 'External causes of morbidity' },
  'Z': { start: 'Z00', end: 'Z99', category: 'Factors influencing health status' },
};

function getCategoryForCode(code) {
  const prefix = code.substring(0, 2);
  const firstChar = code.charAt(0);
  
  // Try 2-character prefix first
  if (CHAPTERS[prefix]) {
    return CHAPTERS[prefix].category;
  }
  
  // Fall back to first character
  if (CHAPTERS[firstChar]) {
    return CHAPTERS[firstChar].category;
  }
  
  return 'Other';
}

function getCodeCategory(code) {
  // Extract the base category (e.g., "I21" from "I21.0")
  const match = code.match(/^([A-Z]\d{2})/);
  return match ? match[1] : code.substring(0, 3);
}

function isBillable(code) {
  // Codes with more than 3 characters are typically billable
  // Codes with 3 characters are usually category headers (not billable)
  return code.length > 3;
}

async function importICD10Codes(filePath) {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting ICD-10-CM 2026 import...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create temporary table for bulk insert
    console.log('📋 Creating temporary staging table...');
    await client.query(`
      CREATE TEMP TABLE icd10_staging (
        code VARCHAR(10),
        description TEXT,
        category VARCHAR(10),
        category_description TEXT,
        billable BOOLEAN,
        valid_for_coding BOOLEAN
      )
    `);
    
    // Read and parse the file
    console.log('📖 Reading ICD-10-CM data file...');
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let batch = [];
    const BATCH_SIZE = 1000;
    let totalCount = 0;
    let billableCount = 0;
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      // Parse space-delimited format: CODE<SPACES>DESCRIPTION
      // Code is first word, description is everything after first whitespace
      const match = line.match(/^(\S+)\s+(.+)$/);
      if (!match) continue;
      
      const code = match[1].trim();
      const description = match[2].trim();
      
      // Skip if code is invalid
      if (!code || !description) continue;
      
      const category = getCodeCategory(code);
      const categoryDescription = getCategoryForCode(code);
      const billable = isBillable(code);
      
      if (billable) billableCount++;
      
      batch.push({
        code,
        description,
        category,
        categoryDescription,
        billable,
        validForCoding: true
      });
      
      // Insert batch when it reaches BATCH_SIZE
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        totalCount += batch.length;
        process.stdout.write(`\r✓ Processed ${totalCount} codes (${billableCount} billable)...`);
        batch = [];
      }
    }
    
    // Insert remaining codes
    if (batch.length > 0) {
      await insertBatch(client, batch);
      totalCount += batch.length;
    }
    
    console.log(`\n\n✓ Staged ${totalCount} codes (${billableCount} billable)`);
    
    // Copy from staging to main table
    console.log('\n📦 Copying to main icd10_codes table...');
    await client.query(`
      INSERT INTO icd10_codes (code, description, category, category_description, billable, valid_for_coding)
      SELECT code, description, category, category_description, billable, valid_for_coding
      FROM icd10_staging
      ON CONFLICT (code) DO UPDATE SET
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        category_description = EXCLUDED.category_description,
        billable = EXCLUDED.billable,
        valid_for_coding = EXCLUDED.valid_for_coding,
        updated_at = NOW()
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get final statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE billable = true) as billable,
        COUNT(DISTINCT category) as categories
      FROM icd10_codes
    `);
    
    console.log('\n✅ Import complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Total codes: ${stats.rows[0].total.toLocaleString()}`);
    console.log(`   Billable codes: ${stats.rows[0].billable.toLocaleString()}`);
    console.log(`   Categories: ${stats.rows[0].categories}`);
    console.log('\n🔍 Sample codes:');
    
    const samples = await client.query(`
      SELECT code, description, billable 
      FROM icd10_codes 
      WHERE billable = true 
      ORDER BY RANDOM() 
      LIMIT 5
    `);
    
    samples.rows.forEach(row => {
      console.log(`   ${row.code} - ${row.description.substring(0, 60)}...`);
    });
    
    console.log('\n✨ ICD-10-CM 2026 database ready for use!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error importing ICD-10 codes:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertBatch(client, batch) {
  const values = batch.map((item, idx) => {
    const offset = idx * 6;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  }).join(',');
  
  const params = batch.flatMap(item => [
    item.code,
    item.description,
    item.category,
    item.categoryDescription,
    item.billable,
    item.validForCoding
  ]);
  
  await client.query(`
    INSERT INTO icd10_staging (code, description, category, category_description, billable, valid_for_coding)
    VALUES ${values}
  `, params);
}

// Main execution
const filePath = process.argv[2] || './downloads/icd10cm-codes-2026.txt';

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  console.error('Usage: node import-icd10-full.js [path-to-icd10cm-codes-2026.txt]');
  process.exit(1);
}

console.log(`📁 File: ${filePath}`);
console.log(`🗄️  Database: ${pool.options.database}`);
console.log('');

importICD10Codes(filePath)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

