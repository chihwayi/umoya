#!/usr/bin/env tsx

/**
 * Comprehensive Test Script for Billing Dashboard & Medical Aid Claims
 * Tests all functionality including:
 * - Financial reports
 * - Tax management
 * - Payment reconciliation
 * - Claims creation and management
 * - Claims analytics
 */

import axios from 'axios';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.name}`);
  if (result.message) {
    console.log(`   ${result.message}`);
  }
}

async function login(): Promise<string> {
  try {
    const response = await axios.post(`${EHR_API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }, {
      headers: { 'X-Tenant-ID': TENANT_SLUG },
    });

    if (response.data?.token) {
      logResult({
        name: 'Login',
        status: 'PASS',
        message: 'Successfully logged in',
      });
      return response.data.token;
    }

    throw new Error('No token in response');
  } catch (error: any) {
    logResult({
      name: 'Login',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
    throw error;
  }
}

async function getPatients(token: string): Promise<any[]> {
  try {
    const response = await axios.get(`${EHR_API_URL}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { limit: 10 },
    });

    return response.data?.patients || response.data || [];
  } catch (error: any) {
    console.error('Failed to get patients:', error.response?.data || error.message);
    return [];
  }
}

async function testFinanceSummary(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/finance/dashboard/summary`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Get Finance Summary',
      status: 'PASS',
      message: `Total Revenue: ${response.data?.totals?.totalAmount || 0}, Outstanding: ${response.data?.totals?.outstandingBalance || 0}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Get Finance Summary',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testFinancialReports(token: string) {
  const reportTypes = ['revenue', 'profit_loss', 'cash_flow', 'aging'];

  for (const reportType of reportTypes) {
    try {
      const response = await axios.get(`${EHR_API_URL}/finance/reports`, {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${token}`,
        },
        params: {
          reportType,
          groupBy: 'month',
        },
      });

      logResult({
        name: `Get ${reportType} Report`,
        status: 'PASS',
        message: `Report generated successfully`,
        data: response.data,
      });
    } catch (error: any) {
      logResult({
        name: `Get ${reportType} Report`,
        status: 'FAIL',
        message: error.response?.data?.message || error.message,
      });
    }
  }
}

async function testTaxManagement(token: string) {
  try {
    // Test tax summary
    const summaryResponse = await axios.get(`${EHR_API_URL}/finance/tax/summary`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Get Tax Summary',
      status: 'PASS',
      message: `Total Tax: ${summaryResponse.data?.totalTax || 0}, Total Revenue: ${summaryResponse.data?.totalRevenue || 0}`,
      data: summaryResponse.data,
    });

    // Test tax calculation
    const calcResponse = await axios.post(
      `${EHR_API_URL}/finance/tax/calculate`,
      { amount: 1000, taxRate: 0.15 },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    logResult({
      name: 'Calculate Tax',
      status: 'PASS',
      message: `Tax Amount: ${calcResponse.data?.taxAmount}, Total with Tax: ${calcResponse.data?.totalWithTax}`,
      data: calcResponse.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Tax Management',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testPaymentReconciliation(token: string) {
  try {
    // Get reconciliation report
    const reportResponse = await axios.get(`${EHR_API_URL}/finance/reconciliation`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Get Reconciliation Report',
      status: 'PASS',
      message: `Total Reconciled: ${reportResponse.data?.summary?.total_reconciled || 0}`,
      data: reportResponse.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Get Reconciliation Report',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testCreateBill(token: string, patientId: string) {
  try {
    const billData = {
      patientId,
      items: [
        {
          code: 'CON001',
          description: 'Consultation Fee',
          quantity: 1,
          unitPrice: 150.00,
          totalPrice: 150.00,
          category: 'consultation',
        },
        {
          code: 'LAB001',
          description: 'Blood Test',
          quantity: 1,
          unitPrice: 75.00,
          totalPrice: 75.00,
          category: 'lab',
        },
      ],
      subtotal: 225.00,
      taxAmount: 33.75,
      discountAmount: 0,
      totalAmount: 258.75,
      status: 'pending',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const response = await axios.post(`${EHR_API_URL}/billing/bills`, billData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Create Bill',
      status: 'PASS',
      message: `Bill created: ${response.data?.billNumber}`,
      data: response.data,
    });

    return response.data;
  } catch (error: any) {
    logResult({
      name: 'Create Bill',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
    return null;
  }
}

async function testGetBills(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/billing/bills`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { limit: 10 },
    });

    logResult({
      name: 'Get Bills',
      status: 'PASS',
      message: `Found ${response.data?.bills?.length || response.data?.length || 0} bills`,
      data: response.data,
    });

    return response.data?.bills || response.data || [];
  } catch (error: any) {
    logResult({
      name: 'Get Bills',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
    return [];
  }
}

async function testAddPayment(token: string, billId: string) {
  try {
    const paymentData = {
      amount: 100.00,
      method: 'cash',
      reference: `PAY-${Date.now()}`,
    };

    const response = await axios.post(`${EHR_API_URL}/billing/bills/${billId}/payments`, paymentData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Add Payment to Bill',
      status: 'PASS',
      message: `Payment added: ${paymentData.amount}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Add Payment to Bill',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testClaimsDashboardSummary(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/claims/dashboard/summary`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Get Claims Dashboard Summary',
      status: 'PASS',
      message: `Total Claims: ${response.data?.summary?.totalClaims || 0}, Total Amount: ${response.data?.summary?.totalAmount || 0}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Get Claims Dashboard Summary',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testGetClaims(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/claims`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { limit: 10 },
    });

    const claims = response.data?.claims || response.data || [];
    logResult({
      name: 'Get Claims',
      status: 'PASS',
      message: `Found ${claims.length} claims`,
      data: response.data,
    });

    return claims;
  } catch (error: any) {
    logResult({
      name: 'Get Claims',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
    return [];
  }
}

async function testCreateClaim(token: string, billId: string, patientId: string) {
  try {
    const claimData = {
      billId,
      patientId,
      medicalAidProvider: 'cimas',
      memberNumber: `MEM${Date.now()}`,
      memberName: 'Test Member',
      claimAmount: 258.75,
    };

    const response = await axios.post(`${EHR_API_URL}/claims`, claimData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Create Claim',
      status: 'PASS',
      message: `Claim created: ${response.data?.claimNumber}`,
      data: response.data,
    });

    return response.data;
  } catch (error: any) {
    logResult({
      name: 'Create Claim',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
    return null;
  }
}

async function testGenerateClaimFromBill(token: string, billId: string) {
  try {
    const claimData = {
      medicalAidProvider: 'premier',
      memberNumber: `MEM${Date.now()}`,
      memberName: 'Auto Generated Member',
    };

    const response = await axios.post(`${EHR_API_URL}/claims/from-bill/${billId}`, claimData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Generate Claim from Bill',
      status: 'PASS',
      message: `Claim generated: ${response.data?.claimNumber}`,
      data: response.data,
    });

    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;
    if (errorMsg.includes('already exists')) {
      logResult({
        name: 'Generate Claim from Bill',
        status: 'SKIP',
        message: 'Claim already exists for this bill',
      });
    } else {
      logResult({
        name: 'Generate Claim from Bill',
        status: 'FAIL',
        message: errorMsg,
      });
    }
    return null;
  }
}

async function testSubmitClaim(token: string, claimId: string) {
  try {
    const response = await axios.put(`${EHR_API_URL}/claims/${claimId}/submit`, {}, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Submit Claim',
      status: 'PASS',
      message: `Claim submitted: ${response.data?.claimNumber}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Submit Claim',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testCheckClaimStatus(token: string, claimId: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/claims/${claimId}/status`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Check Claim Status',
      status: 'PASS',
      message: `Status: ${response.data?.status}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Check Claim Status',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testClaimAnalytics(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/claims/analytics`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Get Claim Analytics',
      status: 'PASS',
      message: `Success Rate: ${response.data?.successRate}%, Avg Turnaround: ${response.data?.turnaroundTime?.avg} days`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Get Claim Analytics',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testProcessClaimResponse(token: string, claimId: string) {
  try {
    const responseData = {
      approved: true,
      approvedAmount: 250.00,
      rejectionReason: null,
    };

    const response = await axios.post(`${EHR_API_URL}/claims/${claimId}/response`, responseData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Process Claim Response (Approved)',
      status: 'PASS',
      message: `Claim approved: ${response.data?.approvedAmount}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Process Claim Response',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testResubmitClaim(token: string, claimId: string) {
  try {
    const updatedData = {
      memberNumber: `MEM-UPDATED-${Date.now()}`,
      memberName: 'Updated Member Name',
    };

    const response = await axios.put(`${EHR_API_URL}/claims/${claimId}/resubmit`, updatedData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
    });

    logResult({
      name: 'Resubmit Claim',
      status: 'PASS',
      message: `Claim prepared for resubmission`,
      data: response.data,
    });
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;
    if (errorMsg.includes('Only rejected')) {
      logResult({
        name: 'Resubmit Claim',
        status: 'SKIP',
        message: 'Claim is not rejected, cannot resubmit',
      });
    } else {
      logResult({
        name: 'Resubmit Claim',
        status: 'FAIL',
        message: errorMsg,
      });
    }
  }
}

async function testFinancialTransactions(token: string) {
  try {
    const response = await axios.get(`${EHR_API_URL}/finance/transactions`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { limit: 10 },
    });

    logResult({
      name: 'Get Financial Transactions',
      status: 'PASS',
      message: `Found ${response.data?.transactions?.length || response.data?.length || 0} transactions`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Get Financial Transactions',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function testRecordPayment(token: string) {
  try {
    // First get a transaction
    const transactionsResponse = await axios.get(`${EHR_API_URL}/finance/transactions`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { limit: 1 },
    });

    const transactions = transactionsResponse.data?.transactions || transactionsResponse.data || [];
    if (transactions.length === 0) {
      logResult({
        name: 'Record Payment',
        status: 'SKIP',
        message: 'No transactions found to record payment for',
      });
      return;
    }

    const transaction = transactions[0];
    if (Number(transaction.balance || 0) <= 0) {
      logResult({
        name: 'Record Payment',
        status: 'SKIP',
        message: 'Transaction already paid',
      });
      return;
    }

    const paymentData = {
      amount: Math.min(Number(transaction.balance || 0), 50.00),
      paymentMethod: 'cash',
      paymentReference: `PAY-${Date.now()}`,
      note: 'Test payment',
    };

    const response = await axios.post(
      `${EHR_API_URL}/finance/transactions/${transaction.id}/payments`,
      paymentData,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    logResult({
      name: 'Record Payment',
      status: 'PASS',
      message: `Payment recorded: ${paymentData.amount}`,
      data: response.data,
    });
  } catch (error: any) {
    logResult({
      name: 'Record Payment',
      status: 'FAIL',
      message: error.response?.data?.message || error.message,
    });
  }
}

async function runAllTests() {
  console.log('🧪 Starting Billing & Claims Module Tests\n');
  console.log('=' .repeat(60));

  try {
    // Login
    const token = await login();
    if (!token) {
      console.log('\n❌ Failed to login. Cannot continue tests.');
      return;
    }

    // Get a patient for testing
    const patients = await getPatients(token);
    if (patients.length === 0) {
      console.log('\n⚠️  No patients found. Some tests will be skipped.');
    }

    const patientId = patients.length > 0 ? patients[0].id : null;

    console.log('\n📊 Testing Billing Dashboard Features...\n');

    // Finance Summary
    await testFinanceSummary(token);

    // Financial Reports
    await testFinancialReports(token);

    // Tax Management
    await testTaxManagement(token);

    // Payment Reconciliation
    await testPaymentReconciliation(token);

    // Financial Transactions
    await testFinancialTransactions(token);

    // Record Payment
    await testRecordPayment(token);

    console.log('\n💰 Testing Bills Management...\n');

    // Get existing bills
    const bills = await testGetBills(token);

    // Create a new bill if we have a patient
    let newBill = null;
    if (patientId) {
      newBill = await testCreateBill(token, patientId);
      if (newBill) {
        await testAddPayment(token, newBill.id);
      }
    }

    console.log('\n🏥 Testing Medical Aid Claims...\n');

    // Claims Dashboard Summary
    await testClaimsDashboardSummary(token);

    // Get existing claims
    const claims = await testGetClaims(token);

    // Create a new claim if we have a bill
    let newClaim = null;
    if (newBill) {
      // Try to generate claim from bill
      newClaim = await testGenerateClaimFromBill(token, newBill.id);
      
      // If that fails (claim exists), create a manual claim
      if (!newClaim && bills.length > 0) {
        newClaim = await testCreateClaim(token, bills[0].id, patientId || bills[0].patientId);
      }
    } else if (bills.length > 0 && patientId) {
      newClaim = await testCreateClaim(token, bills[0].id, patientId);
    }

    // Test claim operations if we have a claim
    if (newClaim) {
      await testCheckClaimStatus(token, newClaim.id);
      
      // Only submit if status is draft
      if (newClaim.status === 'draft') {
        await testSubmitClaim(token, newClaim.id);
      }

      // Test resubmit (will skip if not rejected)
      await testResubmitClaim(token, newClaim.id);
    } else if (claims.length > 0) {
      // Use existing claim for testing
      const existingClaim = claims[0];
      await testCheckClaimStatus(token, existingClaim.id);
      
      if (existingClaim.status === 'draft') {
        await testSubmitClaim(token, existingClaim.id);
      }
    }

    // Claim Analytics
    await testClaimAnalytics(token);

    // Print Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Test Summary\n');

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const skipped = results.filter((r) => r.status === 'SKIP').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total: ${results.length}\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:\n');
      results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);

