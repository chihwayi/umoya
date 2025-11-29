#!/usr/bin/env ts-node

/**
 * Comprehensive Pharmacy Module Test Script
 * Tests all aspects of the pharmacy management system with dummy data
 */

import axios from 'axios';

const BASE_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const TEST_USER_TOKEN = process.env.TEST_TOKEN || '';

// Test data
const testSuppliers = [
  {
    name: 'MedSupply Pharmaceuticals',
    contactPerson: 'John Smith',
    email: 'john@medsupply.com',
    phone: '+263-9-1234567',
    address: '123 Medical Street',
    city: 'Harare',
    country: 'Zimbabwe',
    paymentTerms: 'Net 30',
    taxId: 'TAX-001',
    status: 'active',
    notes: 'Primary supplier for antibiotics and painkillers',
  },
  {
    name: 'Global Health Distributors',
    contactPerson: 'Sarah Johnson',
    email: 'sarah@globalhealth.com',
    phone: '+263-9-2345678',
    address: '456 Health Avenue',
    city: 'Bulawayo',
    country: 'Zimbabwe',
    paymentTerms: 'COD',
    taxId: 'TAX-002',
    status: 'active',
    notes: 'Specializes in chronic disease medications',
  },
  {
    name: 'PharmaCare Solutions',
    contactPerson: 'Mike Williams',
    email: 'mike@pharmacare.com',
    phone: '+263-9-3456789',
    address: '789 Pharmacy Road',
    city: 'Gweru',
    country: 'Zimbabwe',
    paymentTerms: 'Net 15',
    taxId: 'TAX-003',
    status: 'active',
    notes: 'Best prices for generic medications',
  },
];

const testInventoryItems = [
  {
    drugName: 'Paracetamol',
    unitCost: 0.50,
    unitPrice: 1.00,
    quantityOnHand: 0,
    reorderLevel: 100,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    drugName: 'Amoxicillin',
    unitCost: 2.00,
    unitPrice: 4.00,
    quantityOnHand: 0,
    reorderLevel: 50,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    drugName: 'Ibuprofen',
    unitCost: 0.75,
    unitPrice: 1.50,
    quantityOnHand: 0,
    reorderLevel: 75,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    drugName: 'Metformin',
    unitCost: 1.50,
    unitPrice: 3.00,
    quantityOnHand: 0,
    reorderLevel: 200,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    drugName: 'Amlodipine',
    unitCost: 2.50,
    unitPrice: 5.00,
    quantityOnHand: 0,
    reorderLevel: 150,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
];

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message?: string, data?: any) {
  results.push({ test, status, message, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}${message ? `: ${message}` : ''}`);
  if (data && status === 'FAIL') {
    console.log('   Error details:', JSON.stringify(data, null, 2));
  }
}

async function makeRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, data?: any) {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    if (data) {
      config.data = data;
    }
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

async function testSupplierManagement() {
  console.log('\n📦 Testing Supplier Management...');
  const supplierIds: string[] = [];

  // Create suppliers
  for (const supplier of testSuppliers) {
    const result = await makeRequest('POST', '/pharmacy/suppliers', supplier);
    if (result.success) {
      supplierIds.push(result.data.id);
      logResult(`Create Supplier: ${supplier.name}`, 'PASS', `ID: ${result.data.id}`);
    } else {
      logResult(`Create Supplier: ${supplier.name}`, 'FAIL', result.error?.message || 'Unknown error', result.error);
    }
  }

  // List suppliers
  const listResult = await makeRequest('GET', '/pharmacy/suppliers?limit=10');
  if (listResult.success && listResult.data.suppliers) {
    logResult('List Suppliers', 'PASS', `Found ${listResult.data.suppliers.length} suppliers`);
  } else {
    logResult('List Suppliers', 'FAIL', 'Failed to list suppliers', listResult.error);
  }

  // Get supplier details
  if (supplierIds.length > 0) {
    const getResult = await makeRequest('GET', `/pharmacy/suppliers/${supplierIds[0]}`);
    if (getResult.success) {
      logResult('Get Supplier Details', 'PASS', `Retrieved ${getResult.data.name}`);
    } else {
      logResult('Get Supplier Details', 'FAIL', 'Failed to get supplier', getResult.error);
    }

    // Get supplier statistics
    const statsResult = await makeRequest('GET', `/pharmacy/suppliers/${supplierIds[0]}/statistics`);
    if (statsResult.success) {
      logResult('Get Supplier Statistics', 'PASS', `Total orders: ${statsResult.data.total_orders || 0}`);
    } else {
      logResult('Get Supplier Statistics', 'FAIL', 'Failed to get statistics', statsResult.error);
    }
  }

  return supplierIds;
}

async function testInventory(supplierIds: string[]) {
  console.log('\n📋 Testing Inventory Management...');
  const inventoryIds: string[] = [];

  // First, search for drugs
  const drugIds: string[] = [];
  for (const item of testInventoryItems) {
    const searchResult = await makeRequest('GET', `/drugs?search=${encodeURIComponent(item.drugName)}`);
    if (searchResult.success) {
      // Response might be array or object with drugs property
      const drugs = Array.isArray(searchResult.data) 
        ? searchResult.data 
        : (searchResult.data?.drugs || []);
      
      if (drugs.length > 0) {
        // Try to find exact match first, then any match
        const exactMatch = drugs.find((d: any) => 
          d.genericName?.toLowerCase() === item.drugName.toLowerCase() ||
          d.brandNames?.some((b: string) => b.toLowerCase().includes(item.drugName.toLowerCase()))
        );
        const drug = exactMatch || drugs[0];
        drugIds.push(drug.id);
        logResult(`Find Drug: ${item.drugName}`, 'PASS', `ID: ${drug.id}`);
      } else {
        logResult(`Find Drug: ${item.drugName}`, 'SKIP', 'Drug not found, skipping inventory creation');
        drugIds.push('');
      }
    } else {
      logResult(`Find Drug: ${item.drugName}`, 'SKIP', 'Search failed, skipping inventory creation');
      drugIds.push('');
    }
  }

  // Create inventory items
  for (let i = 0; i < testInventoryItems.length; i++) {
    if (!drugIds[i]) continue; // Skip if drug not found
    
    const item = testInventoryItems[i];
    const inventoryData = {
      drugId: drugIds[i],
      expiryDate: item.expiryDate,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
      batchNumber: `BATCH-${Date.now()}-${i}`,
    };
    
    const result = await makeRequest('POST', '/pharmacy/inventory', inventoryData);
    if (result.success) {
      inventoryIds.push(result.data.id);
      logResult(`Create Inventory: ${item.drugName}`, 'PASS', `ID: ${result.data.id}`);
    } else {
      logResult(`Create Inventory: ${item.drugName}`, 'FAIL', result.error?.message || 'Unknown error', result.error);
    }
  }

  // List inventory
  const listResult = await makeRequest('GET', '/pharmacy/inventory?limit=10');
  if (listResult.success && listResult.data.inventory) {
    logResult('List Inventory', 'PASS', `Found ${listResult.data.inventory.length} items`);
  } else {
    logResult('List Inventory', 'FAIL', 'Failed to list inventory', listResult.error);
  }

  // Get low stock items
  const lowStockResult = await makeRequest('GET', '/pharmacy/inventory/low-stock/items');
  if (lowStockResult.success) {
    logResult('Get Low Stock Items', 'PASS', `Found ${lowStockResult.data.items?.length || 0} low stock items`);
  } else {
    logResult('Get Low Stock Items', 'FAIL', 'Failed to get low stock items', lowStockResult.error);
  }

  return inventoryIds;
}

async function testPurchaseOrders(supplierIds: string[], inventoryIds: string[]) {
  console.log('\n🛒 Testing Purchase Orders...');
  const purchaseOrderIds: string[] = [];

  // Create purchase orders
  for (let i = 0; i < 2; i++) {
    const supplierId = supplierIds[i % supplierIds.length];
      const items = [
      {
        inventoryId: inventoryIds[i % inventoryIds.length],
        quantityOrdered: 500,
        unitCost: testInventoryItems[i].unitCost,
        notes: `Test order for ${testInventoryItems[i].drugName}`,
      },
      {
        inventoryId: inventoryIds[(i + 1) % inventoryIds.length],
        quantityOrdered: 300,
        unitCost: testInventoryItems[(i + 1) % testInventoryItems.length].unitCost,
      },
    ];

    const purchaseOrder = {
      supplierId,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      notes: `Test purchase order ${i + 1}`,
      items,
    };

    const result = await makeRequest('POST', '/pharmacy/purchase-orders', purchaseOrder);
    if (result.success) {
      purchaseOrderIds.push(result.data.id);
      logResult(`Create Purchase Order ${i + 1}`, 'PASS', `ID: ${result.data.id}`);
    } else {
      logResult(`Create Purchase Order ${i + 1}`, 'FAIL', result.error?.message || 'Unknown error', result.error);
    }
  }

  // List purchase orders
  const listResult = await makeRequest('GET', '/pharmacy/purchase-orders?limit=10');
  if (listResult.success && listResult.data.orders) {
    logResult('List Purchase Orders', 'PASS', `Found ${listResult.data.orders.length} orders`);
  } else {
    logResult('List Purchase Orders', 'FAIL', 'Failed to list orders', listResult.error);
  }

  // Update purchase order status to 'ordered'
  if (purchaseOrderIds.length > 0) {
    const updateResult = await makeRequest('PUT', `/pharmacy/purchase-orders/${purchaseOrderIds[0]}`, {
      status: 'ordered',
    });
    if (updateResult.success) {
      logResult('Update Purchase Order Status', 'PASS', 'Status updated to ordered');
    } else {
      logResult('Update Purchase Order Status', 'FAIL', 'Failed to update status', updateResult.error);
    }
  }

  return purchaseOrderIds;
}

async function testReceipts(purchaseOrderIds: string[], inventoryIds: string[]) {
  console.log('\n📥 Testing Receipts (GRN)...');
  const receiptIds: string[] = [];

  // Create receipts for purchase orders
  for (const poId of purchaseOrderIds) {
    // Get purchase order details first
    const poResult = await makeRequest('GET', `/pharmacy/purchase-orders/${poId}`);
    if (!poResult.success) continue;

    // Get supplier ID from purchase order
    const supplierId = poResult.data.supplier_id;
    if (!supplierId) {
      logResult(`Create Receipt for PO ${poId.slice(0, 8)}`, 'SKIP', 'Purchase order missing supplier ID');
      continue;
    }

    // Build receipt items - need to get drug IDs from inventory
    const items: any[] = [];
    for (const poItem of (poResult.data.items || [])) {
      if (poItem.inventory_id) {
        const invResult = await makeRequest('GET', `/pharmacy/inventory/${poItem.inventory_id}`);
        if (invResult.success && invResult.data.drug_id) {
          items.push({
            purchaseOrderItemId: poItem.id,
            drugId: invResult.data.drug_id,
            quantityReceived: poItem.quantity_ordered,
            unitCost: parseFloat(poItem.unit_cost?.toString() || '0'),
            condition: 'good',
            batchNumber: `BATCH-${Date.now()}-${items.length}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          });
        }
      }
    }

    const receipt = {
      purchaseOrderId: poId,
      supplierId: supplierId,
      receiptDate: new Date().toISOString().split('T')[0],
      status: 'verified',
      notes: 'Test receipt',
      items,
    };

    const result = await makeRequest('POST', '/pharmacy/receipts', receipt);
    if (result.success) {
      receiptIds.push(result.data.id);
      logResult(`Create Receipt for PO ${poId.slice(0, 8)}`, 'PASS', `ID: ${result.data.id}`);
    } else {
      logResult(`Create Receipt for PO ${poId.slice(0, 8)}`, 'FAIL', result.error?.message || 'Unknown error', result.error);
    }
  }

  // List receipts
  const listResult = await makeRequest('GET', '/pharmacy/receipts?limit=10');
  if (listResult.success && listResult.data.receipts) {
    logResult('List Receipts', 'PASS', `Found ${listResult.data.receipts.length} receipts`);
  } else {
    logResult('List Receipts', 'FAIL', 'Failed to list receipts', listResult.error);
  }

  return receiptIds;
}

async function testDispensing(inventoryIds: string[]) {
  console.log('\n💊 Testing Prescription Dispensing...');

  // First, check if we have any prescriptions
  const prescriptionsResult = await makeRequest('GET', '/pharmacy/prescriptions/pending?limit=10');
  if (!prescriptionsResult.success || !prescriptionsResult.data.prescriptions || prescriptionsResult.data.prescriptions.length === 0) {
    logResult('Get Pending Prescriptions', 'SKIP', 'No pending prescriptions found - creating test prescription would require patient/appointment setup');
    return;
  }

  const prescriptions = prescriptionsResult.data.prescriptions;
  logResult('Get Pending Prescriptions', 'PASS', `Found ${prescriptions.length} pending prescriptions`);

  // Test stock check for first prescription
  if (prescriptions.length > 0) {
    const prescriptionId = prescriptions[0].id;
    const stockCheckResult = await makeRequest('GET', `/pharmacy/prescriptions/${prescriptionId}/stock-check`);
    if (stockCheckResult.success) {
      logResult('Check Prescription Stock', 'PASS', `Available: ${stockCheckResult.data.available}`);
    } else {
      logResult('Check Prescription Stock', 'FAIL', 'Failed to check stock', stockCheckResult.error);
    }

    // Try to dispense (if stock is available)
    if (stockCheckResult.success && stockCheckResult.data.available) {
      const dispensingItems = stockCheckResult.data.matchingItems
        .slice(0, 1)
        .map((item: any) => ({
          inventoryId: item.id,
          quantityDispensed: Math.min(item.quantityOnHand, prescriptions[0].quantity || 1),
        }));

      const dispensingData = {
        items: dispensingItems,
        paymentMethod: 'cash',
        discountAmount: 0,
        amountPaid: 10.00,
        notes: 'Test dispensing',
      };

      const dispenseResult = await makeRequest('POST', `/pharmacy/prescriptions/${prescriptionId}/dispense`, dispensingData);
      if (dispenseResult.success) {
        logResult('Dispense Prescription', 'PASS', `Dispensing ID: ${dispenseResult.data.id}`);
      } else {
        logResult('Dispense Prescription', 'FAIL', dispenseResult.error?.message || 'Unknown error', dispenseResult.error);
      }
    } else {
      logResult('Dispense Prescription', 'SKIP', 'Insufficient stock for test dispensing');
    }
  }
}

async function testAlerts() {
  console.log('\n🚨 Testing Alerts...');

  // List alerts
  const listResult = await makeRequest('GET', '/pharmacy/alerts?resolved=false&limit=10');
  if (listResult.success && listResult.data.alerts) {
    logResult('List Alerts', 'PASS', `Found ${listResult.data.alerts.length} active alerts`);
  } else {
    logResult('List Alerts', 'FAIL', 'Failed to list alerts', listResult.error);
  }
}

async function runAllTests() {
  console.log('🧪 Starting Comprehensive Pharmacy Module Tests...');
  console.log(`📍 Testing tenant: ${TENANT_SLUG}`);
  console.log(`🌐 API URL: ${BASE_URL}\n`);

  if (!TEST_USER_TOKEN) {
    console.error('❌ ERROR: TEST_TOKEN environment variable is required');
    console.log('   Please set TEST_TOKEN with a valid JWT token');
    process.exit(1);
  }

  try {
    // Step 0: Seed drugs if needed
    console.log('\n💊 Seeding drugs database...');
    const seedResult = await makeRequest('POST', '/drugs/seed', {});
    if (seedResult.success) {
      logResult('Seed Drugs', 'PASS', 'Drugs database seeded');
    } else {
      const errorMsg = Array.isArray(seedResult.error?.message) 
        ? seedResult.error.message.join(', ') 
        : (seedResult.error?.message || JSON.stringify(seedResult.error) || 'Unknown error');
      if (errorMsg.includes('already seeded') || errorMsg.includes('Drugs have already been seeded') || (seedResult.error?.statusCode === 400 && errorMsg.includes('Bad Request'))) {
        logResult('Seed Drugs', 'SKIP', 'Drugs already seeded');
      } else {
        logResult('Seed Drugs', 'FAIL', 'Failed to seed drugs', seedResult.error);
      }
    }

    // Test sequence
    const supplierIds = await testSupplierManagement();
    if (supplierIds.length === 0) {
      console.log('\n⚠️  No suppliers created, skipping dependent tests');
      return;
    }

    const inventoryIds = await testInventory(supplierIds);
    if (inventoryIds.length === 0) {
      console.log('\n⚠️  No inventory items created, skipping dependent tests');
      return;
    }

    const purchaseOrderIds = await testPurchaseOrders(supplierIds, inventoryIds);
    await testReceipts(purchaseOrderIds, inventoryIds);
    await testDispensing(inventoryIds);
    await testAlerts();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.test}: ${r.message || 'Unknown error'}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during testing:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();

