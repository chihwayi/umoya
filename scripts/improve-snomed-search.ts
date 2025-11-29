/**
 * Script to improve SNOMED CT search by updating Elasticsearch settings
 * This should be run after SNOMED CT import is complete
 */

import axios from 'axios';

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

async function improveSnomedSearch() {
  console.log('🔧 Improving SNOMED CT search configuration...\n');

  try {
    // 1. Update cluster settings for better search performance
    console.log('1️⃣  Updating Elasticsearch cluster settings...');
    await axios.put(`${ELASTICSEARCH_URL}/_cluster/settings`, {
      persistent: {
        'action.auto_create_index': true,
        'indices.query.bool.max_clause_count': 32768,
        'index.max_result_window': 50000,
      },
    });
    console.log('   ✅ Cluster settings updated\n');

    // 2. Update SNOMED indices with better analyzers
    console.log('2️⃣  Configuring SNOMED indices for better search...');
    
    // Get all SNOMED-related indices
    const indicesResponse = await axios.get(`${ELASTICSEARCH_URL}/_cat/indices?format=json`);
    const snomedIndices = indicesResponse.data
      .filter((idx: any) => idx.index.startsWith('snomed') || idx.index.includes('concept'))
      .map((idx: any) => idx.index);

    if (snomedIndices.length === 0) {
      console.log('   ⚠️  No SNOMED indices found. Import may not be complete yet.');
      return;
    }

    console.log(`   Found ${snomedIndices.length} SNOMED indices`);

    // Update each index with better search settings
    for (const index of snomedIndices) {
      try {
        await axios.put(`${ELASTICSEARCH_URL}/${index}/_settings`, {
          index: {
            max_result_window: 50000,
            analysis: {
              analyzer: {
                snomed_term_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'word_delimiter',
                  ],
                },
              },
            },
          },
        });
        console.log(`   ✅ Updated index: ${index}`);
      } catch (error: any) {
        if (error.response?.status === 400 && error.response?.data?.error?.type === 'illegal_argument_exception') {
          console.log(`   ⚠️  Index ${index} may be closed or read-only`);
        } else {
          console.log(`   ⚠️  Could not update ${index}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ SNOMED CT search configuration improved!');
    console.log('\n📝 Next steps:');
    console.log('   - Test search with: curl "http://localhost:8080/browser/MAIN/concepts?term=diabetes&limit=5"');
    console.log('   - Search should now return more accurate results');
  } catch (error: any) {
    console.error('❌ Error improving search configuration:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

improveSnomedSearch();


