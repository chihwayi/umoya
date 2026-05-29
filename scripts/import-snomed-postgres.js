const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'umoya',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const BATCH_SIZE = 2000;

const FILES = {
  concepts: process.env.SNOMED_CONCEPTS_FILE,
  descriptions: process.env.SNOMED_DESCRIPTIONS_FILE,
  mappings: process.env.SNOMED_MAPPING_FILE
};

async function processFile(filePath, processor) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`⚠️ Skipping ${filePath} (not found)`);
    return;
  }

  console.log(`📖 Reading ${path.basename(filePath)} into memory...`);
  
  // Read full file - 215MB is fine for Node.js
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  console.log(`ℹ️  Total lines: ${lines.length}`);

  const client = await pool.connect();
  let batch = [];
  let count = 0;
  let skipped = 0;
  
  try {
    await client.query('BEGIN');

    // Skip header (index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split('\t').map(c => c.trim()); // Trim each cell
      
      try {
        const item = processor(row);
        if (item) {
          batch.push(item);
        } else {
            skipped++;
        }
      } catch (err) {
        console.warn(`⚠️ Warning: Failed to parse line ${i + 1}: ${err.message}`);
        skipped++;
      }

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        count += batch.length;
        if (count % 10000 === 0) {
            process.stdout.write(`\r✓ Processed ${count} rows...`);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      await insertBatch(client, batch);
      count += batch.length;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Finished ${path.basename(filePath)}: ${count} rows imported, ${skipped} skipped.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Error processing ${filePath}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return;

  const tableName = batch[0].tableName;
  const columns = batch[0].columns;
  const placeholders = batch.map((_, i) => 
    `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
  ).join(', ');

  const values = batch.flatMap(item => item.values);

  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
  `;

  await client.query(query, values);
}

function parseDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function parseBool(boolStr) {
  return boolStr === '1';
}

const processors = {
  concepts: (row) => {
    if (row.length < 5) return null;
    return {
      tableName: 'snomed_concepts',
      columns: ['concept_id', 'effective_time', 'active', 'module_id', 'definition_status_id'],
      values: [
        row[0],
        parseDate(row[1]),
        parseBool(row[2]),
        row[3],
        row[4]
      ]
    };
  },
  descriptions: (row) => {
    if (row.length < 9) return null;
    return {
      tableName: 'snomed_descriptions',
      columns: ['description_id', 'effective_time', 'active', 'module_id', 'concept_id', 'language_code', 'type_id', 'term', 'case_significance_id'],
      values: [
        row[0],
        parseDate(row[1]),
        parseBool(row[2]),
        row[3],
        row[4],
        row[5],
        row[6],
        row[7],
        row[8]
      ]
    };
  },
  mappings: (row) => {
    // 0: id, 1: effectiveTime, 2: active, 5: referencedComponentId (snomed), 6: referencedComponentName, 
    // 7: mapGroup, 8: mapPriority, 9: mapRule, 10: mapAdvice, 11: mapTarget (icd10), 12: mapTargetName, 13: correlationId, 15: mapCategoryId
    
    if (row.length < 12 || !row[11]) return null;

    let icd10 = row[11].replace(/\./g, '');
    if (icd10.includes('?')) return null; // Skip ambiguous mappings

    return {
      tableName: 'snomed_to_icd10_map',
      columns: ['snomed_code', 'snomed_term', 'icd10_code', 'map_category', 'map_rule', 'map_priority', 'correlation', 'active'],
      values: [
        row[5], 
        row[6], 
        icd10, 
        row[15] || null, 
        row[9] || null, 
        parseInt(row[8]) || 1, 
        row[13] || null, 
        parseBool(row[2])
      ]
    };
  }
};

async function main() {
  console.log(`🗄️  Database: ${pool.options.database}`);

  if (FILES.concepts) {
    await processFile(FILES.concepts, processors.concepts);
  }
  
  if (FILES.descriptions) {
    await processFile(FILES.descriptions, processors.descriptions);
  }

  // Refresh materialized view
  if (FILES.concepts || FILES.descriptions) {
    console.log('🔄 Refreshing snomed_search_view...');
    const client = await pool.connect();
    try {
      await client.query('REFRESH MATERIALIZED VIEW snomed_search_view');
      console.log('✅ View refreshed.');
    } catch (err) {
      console.error('❌ Failed to refresh view:', err.message);
    } finally {
      client.release();
    }
  }

  if (FILES.mappings) {
    await processFile(FILES.mappings, processors.mappings);
  }

  await pool.end();
}

main().catch(console.error);
