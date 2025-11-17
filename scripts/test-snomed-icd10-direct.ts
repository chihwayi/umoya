#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

/**
 * Direct database test for SNOMED search cache and ICD-10 mappings
 * Tests the actual data in tenant databases
 */

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

async function testSnomedCache(tenantDb: Client): Promise<TestResult> {
  try {
    // Check if cache table exists
    const tableCheck = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'snomed_search_cache'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      return {
        test: 'SNOMED Cache Table',
        passed: false,
        message: 'snomed_search_cache table does not exist',
      };
    }

    // Check if there's any cached data
    const cacheCount = await tenantDb.query(`
      SELECT COUNT(*) as count FROM snomed_search_cache
    `);

    const count = parseInt(cacheCount.rows[0]?.count || '0', 10);

    // Check a sample cache entry
    const sampleCache = await tenantDb.query(`
      SELECT search_term, data, created_at 
      FROM snomed_search_cache 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (sampleCache.rows.length > 0) {
      const cacheData = sampleCache.rows[0].data;
      if (cacheData && cacheData.concepts && Array.isArray(cacheData.concepts)) {
        const hasConceptIds = cacheData.concepts.some(
          (c: any) => c.conceptId && /^\d+$/.test(c.conceptId),
        );

        return {
          test: 'SNOMED Cache Data',
          passed: hasConceptIds,
          message: hasConceptIds
            ? `Cache contains ${count} entries with valid concept IDs`
            : 'Cache entries exist but concepts missing valid conceptId',
          data: {
            cacheEntries: count,
            sampleConcept: hasConceptIds
              ? cacheData.concepts.find((c: any) => c.conceptId)
              : null,
          },
        };
      }
    }

    return {
      test: 'SNOMED Cache Data',
      passed: count > 0,
      message: count > 0
        ? `Cache has ${count} entries but structure needs verification`
        : 'No cached SNOMED searches found (this is OK if no searches have been performed)',
      data: { cacheEntries: count },
    };
  } catch (error: any) {
    return {
      test: 'SNOMED Cache',
      passed: false,
      message: `Error: ${error.message}`,
    };
  }
}

async function testIcd10Mappings(tenantDb: Client): Promise<TestResult> {
  try {
    // Check if mapping table exists
    const tableCheck = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'snomed_icd10_mappings'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      return {
        test: 'ICD-10 Mapping Table',
        passed: false,
        message: 'snomed_icd10_mappings table does not exist',
      };
    }

    // Check total mappings
    const totalMappings = await tenantDb.query(`
      SELECT COUNT(*) as count FROM snomed_icd10_mappings WHERE active = true
    `);

    const count = parseInt(totalMappings.rows[0]?.count || '0', 10);

    if (count === 0) {
      return {
        test: 'ICD-10 Mappings',
        passed: false,
        message: 'No active ICD-10 mappings found in database',
      };
    }

    // Get sample mappings
    const sampleMappings = await tenantDb.query(`
      SELECT concept_id, target_code, target_display, map_group, map_priority, map_status
      FROM snomed_icd10_mappings
      WHERE active = true
      ORDER BY concept_id
      LIMIT 5
    `);

    // Validate structure
    const validMappings = sampleMappings.rows.every(
      (m) =>
        m.concept_id &&
        /^\d+$/.test(m.concept_id) &&
        m.target_code &&
        typeof m.map_group === 'number' &&
        typeof m.map_priority === 'number',
    );

    // Test a specific concept lookup
    const testConceptId = sampleMappings.rows[0]?.concept_id;
    const conceptMappings = await tenantDb.query(
      `
      SELECT concept_id, target_code, target_display, map_group, map_priority
      FROM snomed_icd10_mappings
      WHERE concept_id = $1 AND active = true
      ORDER BY map_group, map_priority
      LIMIT 5
    `,
      [testConceptId],
    );

    return {
      test: 'ICD-10 Mappings',
      passed: validMappings && conceptMappings.rows.length > 0,
      message: validMappings
        ? `Found ${count} active mappings. Sample concept ${testConceptId} has ${conceptMappings.rows.length} mappings`
        : 'Mappings exist but structure is invalid',
      data: {
        totalMappings: count,
        sampleConcept: testConceptId,
        sampleMappings: conceptMappings.rows.slice(0, 3).map((m) => ({
          conceptId: m.concept_id,
          icd10Code: m.target_code,
          icd10Display: m.target_display,
          mapGroup: m.map_group,
          mapPriority: m.map_priority,
        })),
      },
    };
  } catch (error: any) {
    return {
      test: 'ICD-10 Mappings',
      passed: false,
      message: `Error: ${error.message}`,
    };
  }
}

async function testIcd10Metadata(tenantDb: Client): Promise<TestResult> {
  try {
    const metadataCheck = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'icd10_mapping_metadata'
      ) as exists
    `);

    if (!metadataCheck.rows[0]?.exists) {
      return {
        test: 'ICD-10 Metadata Table',
        passed: false,
        message: 'icd10_mapping_metadata table does not exist',
      };
    }

    const metadata = await tenantDb.query(`
      SELECT release_label, effective_time, total_rows, import_completed_at
      FROM icd10_mapping_metadata
      ORDER BY import_completed_at DESC
      LIMIT 1
    `);

    if (metadata.rows.length === 0) {
      return {
        test: 'ICD-10 Metadata',
        passed: false,
        message: 'No metadata records found',
      };
    }

    return {
      test: 'ICD-10 Metadata',
      passed: true,
      message: `Metadata found: ${metadata.rows[0].release_label} with ${metadata.rows[0].total_rows} rows`,
      data: metadata.rows[0],
    };
  } catch (error: any) {
    return {
      test: 'ICD-10 Metadata',
      passed: false,
      message: `Error: ${error.message}`,
    };
  }
}

async function testEndToEndQuery(tenantDb: Client): Promise<TestResult> {
  try {
    // Find a concept that has both SNOMED data and ICD-10 mappings
    const testQuery = await tenantDb.query(`
      SELECT DISTINCT m.concept_id, m.target_code, m.target_display
      FROM snomed_icd10_mappings m
      WHERE m.active = true
      LIMIT 1
    `);

    if (testQuery.rows.length === 0) {
      return {
        test: 'End-to-End Query',
        passed: false,
        message: 'No mappings available for testing',
      };
    }

    const testConcept = testQuery.rows[0];
    const conceptId = testConcept.concept_id;

    // Query all mappings for this concept
    const mappings = await tenantDb.query(
      `
      SELECT concept_id, target_code, target_display, map_group, map_priority, map_status, map_advice
      FROM snomed_icd10_mappings
      WHERE concept_id = $1 AND active = true
      ORDER BY map_group, map_priority
      LIMIT 10
    `,
      [conceptId],
    );

    const hasValidMappings =
      mappings.rows.length > 0 &&
      mappings.rows.every(
        (m) =>
          m.concept_id === conceptId &&
          m.target_code &&
          typeof m.map_group === 'number',
      );

    return {
      test: 'End-to-End Query',
      passed: hasValidMappings,
      message: hasValidMappings
        ? `Successfully queried concept ${conceptId} → found ${mappings.rows.length} ICD-10 mappings`
        : `Query returned invalid results for concept ${conceptId}`,
      data: {
        conceptId,
        mappingCount: mappings.rows.length,
        sampleMappings: mappings.rows.slice(0, 3).map((m) => ({
          icd10Code: m.target_code,
          icd10Display: m.target_display,
          group: m.map_group,
          priority: m.map_priority,
          status: m.map_status,
        })),
      },
    };
  } catch (error: any) {
    return {
      test: 'End-to-End Query',
      passed: false,
      message: `Error: ${error.message}`,
    };
  }
}

async function main() {
  const tenantSlug = process.argv[2] || 'bulawayo-general';
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  console.log('🧪 Testing SNOMED Search Cache and ICD-10 Mappings\n');
  console.log(`Tenant: ${tenantSlug}\n`);

  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    // Get tenant connection info
    const tenantResult = await masterClient.query(
      `SELECT "databaseName", "connectionString" FROM tenants WHERE subdomain = $1`,
      [tenantSlug],
    );

    if (tenantResult.rows.length === 0) {
      console.error(`❌ Tenant '${tenantSlug}' not found`);
      process.exit(1);
    }

    const tenant = tenantResult.rows[0];
    let connectionString = tenant.connectionString;

    if (!connectionString) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const username = process.env.DB_USERNAME || 'medicore';
      const password = process.env.DB_PASSWORD || 'medicore_password';
      connectionString = `postgresql://${username}:${password}@${host}:${port}/${tenant.databaseName}`;
    } else {
      connectionString = connectionString.replace(/postgres-master/g, 'localhost');
    }

    console.log(`Connecting to tenant database: ${tenant.databaseName}...\n`);

    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    try {
      const results: TestResult[] = [];

      // Test 1: SNOMED Cache
      console.log('1️⃣  Testing SNOMED Search Cache...');
      const cacheResult = await testSnomedCache(tenantClient);
      results.push(cacheResult);
      console.log(
        cacheResult.passed ? '✅' : '⚠️',
        cacheResult.test,
        '-',
        cacheResult.message,
      );
      if (cacheResult.data) {
        console.log('   ', JSON.stringify(cacheResult.data, null, 2).replace(/\n/g, '\n   '));
      }
      console.log('');

      // Test 2: ICD-10 Mappings
      console.log('2️⃣  Testing ICD-10 Mappings...');
      const mappingResult = await testIcd10Mappings(tenantClient);
      results.push(mappingResult);
      console.log(
        mappingResult.passed ? '✅' : '❌',
        mappingResult.test,
        '-',
        mappingResult.message,
      );
      if (mappingResult.data) {
        console.log('   ', JSON.stringify(mappingResult.data, null, 2).replace(/\n/g, '\n   '));
      }
      console.log('');

      // Test 3: ICD-10 Metadata
      console.log('3️⃣  Testing ICD-10 Metadata...');
      const metadataResult = await testIcd10Metadata(tenantClient);
      results.push(metadataResult);
      console.log(
        metadataResult.passed ? '✅' : '❌',
        metadataResult.test,
        '-',
        metadataResult.message,
      );
      if (metadataResult.data) {
        console.log('   ', JSON.stringify(metadataResult.data, null, 2).replace(/\n/g, '\n   '));
      }
      console.log('');

      // Test 4: End-to-End Query
      console.log('4️⃣  Testing End-to-End Query...');
      const e2eResult = await testEndToEndQuery(tenantClient);
      results.push(e2eResult);
      console.log(
        e2eResult.passed ? '✅' : '❌',
        e2eResult.test,
        '-',
        e2eResult.message,
      );
      if (e2eResult.data) {
        console.log('   ', JSON.stringify(e2eResult.data, null, 2).replace(/\n/g, '\n   '));
      }
      console.log('');

      // Summary
      const criticalTests = [mappingResult, metadataResult, e2eResult];
      const criticalPassed = criticalTests.every((r) => r.passed);
      const allPassed = results.every((r) => r.passed || r.test.includes('Cache')); // Cache is optional

      console.log('📊 Test Summary:');
      results.forEach((r) => {
        const status = r.passed ? '✅ PASS' : r.test.includes('Cache') ? '⚠️  OPTIONAL' : '❌ FAIL';
        console.log(`   ${r.test}: ${status}`);
      });
      console.log('');

      if (criticalPassed) {
        console.log('✅ All critical tests passed! SNOMED → ICD-10 mapping is working correctly.');
      } else {
        console.log('❌ Some critical tests failed. Please check the errors above.');
      }

      process.exit(criticalPassed ? 0 : 1);
    } finally {
      await tenantClient.end();
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});

