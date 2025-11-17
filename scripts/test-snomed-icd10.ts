#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';
import axios from 'axios';

/**
 * Comprehensive test script for SNOMED search and ICD-10 mapping
 * Tests:
 * 1. SNOMED search returns actual concept IDs
 * 2. ICD-10 mapping works for SNOMED concepts
 * 3. End-to-end workflow
 */

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

async function testSnomedSearch(
  baseUrl: string,
  token: string,
  tenantSlug: string,
): Promise<TestResult> {
  try {
    const response = await axios.get(`${baseUrl}/terminology/snomed/search`, {
      params: {
        term: 'diabetes',
        limit: 10,
      },
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });

    const result = response.data;

    if (!result.concepts || !Array.isArray(result.concepts)) {
      return {
        test: 'SNOMED Search Structure',
        passed: false,
        message: 'Response does not contain concepts array',
      };
    }

    if (result.concepts.length === 0) {
      return {
        test: 'SNOMED Search Results',
        passed: false,
        message: 'No concepts returned for search term "diabetes"',
      };
    }

    // Check if concepts have conceptId
    const hasConceptIds = result.concepts.every(
      (c: any) => c.conceptId && /^\d+$/.test(c.conceptId),
    );

    if (!hasConceptIds) {
      return {
        test: 'SNOMED Concept IDs',
        passed: false,
        message: 'Some concepts missing valid conceptId (numeric)',
        data: result.concepts.map((c: any) => ({
          conceptId: c.conceptId,
          term: c.term,
        })),
      };
    }

    return {
      test: 'SNOMED Search',
      passed: true,
      message: `Found ${result.concepts.length} concepts with valid IDs`,
      data: {
        total: result.total,
        concepts: result.concepts.slice(0, 3).map((c: any) => ({
          conceptId: c.conceptId,
          term: c.term,
          preferredTerm: c.preferredTerm,
        })),
      },
    };
  } catch (error: any) {
    return {
      test: 'SNOMED Search',
      passed: false,
      message: `Error: ${error.message}`,
      data: error.response?.data,
    };
  }
}

async function testIcd10Mapping(
  baseUrl: string,
  token: string,
  tenantSlug: string,
  snomedConceptId: string,
): Promise<TestResult> {
  try {
    const response = await axios.get(
      `${baseUrl}/terminology/snomed/map/${snomedConceptId}/ICD10`,
      {
        params: {
          primaryOnly: false,
          limit: 10,
        },
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const mappings = response.data;

    if (!Array.isArray(mappings)) {
      return {
        test: 'ICD-10 Mapping Structure',
        passed: false,
        message: 'Response is not an array',
      };
    }

    if (mappings.length === 0) {
      return {
        test: 'ICD-10 Mapping Results',
        passed: false,
        message: `No ICD-10 mappings found for SNOMED concept ${snomedConceptId}`,
      };
    }

    // Validate mapping structure
    const validMappings = mappings.every(
      (m: any) =>
        m.conceptId &&
        m.targetCode &&
        typeof m.mapGroup === 'number' &&
        typeof m.mapPriority === 'number',
    );

    if (!validMappings) {
      return {
        test: 'ICD-10 Mapping Structure',
        passed: false,
        message: 'Some mappings missing required fields',
        data: mappings[0],
      };
    }

    return {
      test: 'ICD-10 Mapping',
      passed: true,
      message: `Found ${mappings.length} ICD-10 mappings`,
      data: {
        conceptId: snomedConceptId,
        mappings: mappings.slice(0, 3).map((m: any) => ({
          targetCode: m.targetCode,
          targetDisplay: m.targetDisplay,
          mapGroup: m.mapGroup,
          mapPriority: m.mapPriority,
          mapStatus: m.mapStatus,
        })),
      },
    };
  } catch (error: any) {
    return {
      test: 'ICD-10 Mapping',
      passed: false,
      message: `Error: ${error.message}`,
      data: error.response?.data,
    };
  }
}

async function testEndToEnd(
  baseUrl: string,
  token: string,
  tenantSlug: string,
): Promise<TestResult> {
  try {
    // Step 1: Search for a diagnosis
    const searchResponse = await axios.get(`${baseUrl}/terminology/snomed/search`, {
      params: {
        term: 'hypertension',
        limit: 5,
      },
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });

    const concepts = searchResponse.data.concepts;
    if (!concepts || concepts.length === 0) {
      return {
        test: 'End-to-End Workflow',
        passed: false,
        message: 'No SNOMED concepts found for "hypertension"',
      };
    }

    const selectedConcept = concepts[0];
    if (!selectedConcept.conceptId) {
      return {
        test: 'End-to-End Workflow',
        passed: false,
        message: 'Selected concept missing conceptId',
      };
    }

    // Step 2: Get ICD-10 mappings for the selected concept
    const mappingResponse = await axios.get(
      `${baseUrl}/terminology/snomed/map/${selectedConcept.conceptId}/ICD10`,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const mappings = mappingResponse.data;
    const hasMappings = Array.isArray(mappings) && mappings.length > 0;

    return {
      test: 'End-to-End Workflow',
      passed: hasMappings,
      message: hasMappings
        ? `Successfully: searched SNOMED → found concept ${selectedConcept.conceptId} → retrieved ${mappings.length} ICD-10 mappings`
        : `SNOMED search worked, but no ICD-10 mappings found for concept ${selectedConcept.conceptId}`,
      data: {
        snomedConcept: {
          conceptId: selectedConcept.conceptId,
          term: selectedConcept.term,
        },
        icd10Mappings: hasMappings
          ? mappings.slice(0, 3).map((m: any) => ({
              code: m.targetCode,
              display: m.targetDisplay,
            }))
          : [],
      },
    };
  } catch (error: any) {
    return {
      test: 'End-to-End Workflow',
      passed: false,
      message: `Error: ${error.message}`,
      data: error.response?.data,
    };
  }
}

async function main() {
  const tenantSlug = process.argv[2] || 'bulawayo-general';
  const baseUrl = process.env.EHR_API_URL || 'http://localhost:3001/api';
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  console.log('🧪 Testing SNOMED Search and ICD-10 Mapping\n');
  console.log(`Tenant: ${tenantSlug}`);
  console.log(`API URL: ${baseUrl}\n`);

  // Get tenant info and generate token (simplified - in production use proper auth)
  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    const tenantResult = await masterClient.query(
      `SELECT id, subdomain, "databaseName" FROM tenants WHERE subdomain = $1`,
      [tenantSlug],
    );

    if (tenantResult.rows.length === 0) {
      console.error(`❌ Tenant '${tenantSlug}' not found`);
      process.exit(1);
    }

    // For testing, we'll use a mock token or get from env
    // In production, you'd authenticate properly
    const token = process.env.TEST_TOKEN || 'test-token-placeholder';

    console.log('Running tests...\n');

    // Test 1: SNOMED Search
    console.log('1️⃣  Testing SNOMED Search...');
    const searchResult = await testSnomedSearch(baseUrl, token, tenantSlug);
    console.log(
      searchResult.passed ? '✅' : '❌',
      searchResult.test,
      '-',
      searchResult.message,
    );
    if (searchResult.data) {
      console.log('   Data:', JSON.stringify(searchResult.data, null, 2));
    }
    console.log('');

    if (!searchResult.passed) {
      console.error('❌ SNOMED search failed. Cannot proceed with ICD-10 tests.');
      process.exit(1);
    }

    // Get a concept ID for ICD-10 testing
    const testConceptId = searchResult.data?.concepts?.[0]?.conceptId || '73211009'; // Diabetes default

    // Test 2: ICD-10 Mapping
    console.log(`2️⃣  Testing ICD-10 Mapping for concept ${testConceptId}...`);
    const mappingResult = await testIcd10Mapping(baseUrl, token, tenantSlug, testConceptId);
    console.log(
      mappingResult.passed ? '✅' : '❌',
      mappingResult.test,
      '-',
      mappingResult.message,
    );
    if (mappingResult.data) {
      console.log('   Data:', JSON.stringify(mappingResult.data, null, 2));
    }
    console.log('');

    // Test 3: End-to-End
    console.log('3️⃣  Testing End-to-End Workflow...');
    const e2eResult = await testEndToEnd(baseUrl, token, tenantSlug);
    console.log(
      e2eResult.passed ? '✅' : '❌',
      e2eResult.test,
      '-',
      e2eResult.message,
    );
    if (e2eResult.data) {
      console.log('   Data:', JSON.stringify(e2eResult.data, null, 2));
    }
    console.log('');

    // Summary
    const allPassed = searchResult.passed && mappingResult.passed && e2eResult.passed;
    console.log('📊 Test Summary:');
    console.log(`   SNOMED Search: ${searchResult.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ICD-10 Mapping: ${mappingResult.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   End-to-End: ${e2eResult.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');

    process.exit(allPassed ? 0 : 1);
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});

