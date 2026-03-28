#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EHR_BASE_URL = (process.env.EHR_BASE_URL || 'http://localhost:3013').replace(/\/+$/, '');
const EHR_API_BASE = `${EHR_BASE_URL}/api`;
const TENANT_ID = process.env.TENANT_ID || 'kids-clinic';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gina@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 25000);

const runStartedAt = new Date();
const stamp = runStartedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.resolve(process.cwd(), 'reports');
const reportPath = path.join(reportDir, `smoke-radiography-finance-pharmacy-${stamp}.json`);

const report = {
  startedAt: runStartedAt.toISOString(),
  environment: {
    EHR_BASE_URL,
    EHR_API_BASE,
    TENANT_ID,
    adminEmail: ADMIN_EMAIL,
  },
  artifacts: {},
  checks: {},
  steps: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    criticalFailed: 0,
  },
};

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clip(value, max = 500) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

async function httpRequest({
  label,
  method = 'GET',
  url,
  token,
  tenantId,
  json,
  headers = {},
  expectedStatus = [200, 201],
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = { ...headers };

  if (tenantId) requestHeaders['X-Tenant-ID'] = tenantId;
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (json !== undefined) requestHeaders['Content-Type'] = 'application/json';

  let response;
  let text = '';
  let parsed = null;
  let ok = false;
  let error = null;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: controller.signal,
    });

    text = await response.text();
    parsed = safeJsonParse(text);
    ok = expectedStatus.includes(response.status);
    if (!ok) {
      error = `HTTP ${response.status} for ${method} ${url}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  report.steps.push({
    label,
    ok,
    method,
    url,
    status: response?.status || null,
    error,
    responsePreview: parsed ? clip(parsed) : clip(text),
  });

  if (!ok) {
    const detail = parsed?.message || parsed?.error || error || 'Request failed';
    throw new Error(`${label} failed: ${detail}`);
  }

  return {
    status: response.status,
    data: parsed ?? text,
  };
}

async function runStep(label, fn, options = {}) {
  const { critical = true } = options;
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.steps.push({
      label: `${label} (exception)`,
      ok: false,
      method: 'N/A',
      url: 'N/A',
      status: null,
      error: message,
      responsePreview: '',
      critical,
    });
    if (critical) {
      throw err;
    }
  }
}

function summarize() {
  const total = report.steps.length;
  const passed = report.steps.filter((step) => step.ok).length;
  const failed = total - passed;
  const criticalFailed = report.steps.filter((step) => step.method === 'N/A' && step.critical).length;
  report.summary = { total, passed, failed, criticalFailed };
}

async function main() {
  let token = '';
  let pharmacyInventory = [];
  let pendingPrescriptions = [];
  let financeTransactions = [];
  let imagingWorklist = [];
  let imagingOrders = [];
  let imagingStudies = [];

  await runStep('Login as admin', async () => {
    const res = await httpRequest({
      label: 'Admin login',
      method: 'POST',
      url: `${EHR_API_BASE}/auth/login`,
      tenantId: TENANT_ID,
      json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    token = res.data?.token;
    if (!token) throw new Error('Missing token from admin login');
    report.artifacts.adminUser = res.data?.user || null;
  });

  await runStep('Pharmacy inventory endpoint', async () => {
    const res = await httpRequest({
      label: 'Pharmacy inventory list',
      method: 'GET',
      url: `${EHR_API_BASE}/pharmacy/inventory?limit=25`,
      tenantId: TENANT_ID,
      token,
    });
    pharmacyInventory = Array.isArray(res.data?.inventory) ? res.data.inventory : [];
    report.checks.pharmacyInventoryCount = pharmacyInventory.length;
  });

  await runStep('Pharmacy pending prescriptions endpoint', async () => {
    const res = await httpRequest({
      label: 'Pharmacy pending prescriptions',
      method: 'GET',
      url: `${EHR_API_BASE}/pharmacy/prescriptions/pending?limit=25`,
      tenantId: TENANT_ID,
      token,
    });
    pendingPrescriptions = Array.isArray(res.data) ? res.data : [];
    report.checks.pendingPrescriptionCount = pendingPrescriptions.length;
    report.checks.pendingPrescriptionWithStock = pendingPrescriptions.filter((row) => !!row.stockAvailability?.available).length;
  });

  await runStep('Finance dashboard summary endpoint', async () => {
    const res = await httpRequest({
      label: 'Finance summary',
      method: 'GET',
      url: `${EHR_API_BASE}/finance/dashboard/summary`,
      tenantId: TENANT_ID,
      token,
    });
    report.checks.financeSummary = {
      totalAmount: Number(res.data?.totals?.totalAmount || 0),
      outstandingBalance: Number(res.data?.totals?.outstandingBalance || 0),
      pendingClaims: Number(res.data?.pendingClaims?.count || 0),
    };
  });

  await runStep('Finance transactions endpoint', async () => {
    const res = await httpRequest({
      label: 'Finance transactions',
      method: 'GET',
      url: `${EHR_API_BASE}/finance/transactions?limit=50`,
      tenantId: TENANT_ID,
      token,
    });
    financeTransactions = Array.isArray(res.data?.transactions) ? res.data.transactions : [];
    report.checks.financeTransactionsCount = financeTransactions.length;
  });

  await runStep('Radiology worklist endpoint', async () => {
    const res = await httpRequest({
      label: 'Imaging worklist',
      method: 'GET',
      url: `${EHR_API_BASE}/imaging/worklist`,
      tenantId: TENANT_ID,
      token,
    });
    imagingWorklist = Array.isArray(res.data?.studies) ? res.data.studies : [];
    report.checks.imagingWorklistCount = imagingWorklist.length;
  });

  await runStep('Radiology orders endpoint', async () => {
    const res = await httpRequest({
      label: 'Imaging orders',
      method: 'GET',
      url: `${EHR_API_BASE}/imaging/orders?limit=50`,
      tenantId: TENANT_ID,
      token,
    });
    imagingOrders = Array.isArray(res.data?.orders) ? res.data.orders : [];
    report.checks.imagingOrdersCount = imagingOrders.length;
  });

  await runStep('Radiology studies endpoint', async () => {
    const res = await httpRequest({
      label: 'Imaging studies',
      method: 'GET',
      url: `${EHR_API_BASE}/imaging/studies?status=in_progress`,
      tenantId: TENANT_ID,
      token,
    });
    imagingStudies = Array.isArray(res.data?.studies) ? res.data.studies : [];
    report.checks.imagingStudiesInProgressCount = imagingStudies.length;
  });

  await runStep('Cross-module sync integrity checks', async () => {
    const financePatientIds = new Set(
      financeTransactions
        .map((row) => row.patient_id)
        .filter(Boolean),
    );

    const pendingRxPatientIds = new Set(
      pendingPrescriptions
        .map((row) => row.patient_id)
        .filter(Boolean),
    );

    const imagingOrderPatientIds = new Set(
      imagingOrders
        .map((row) => row.patient_id)
        .filter(Boolean),
    );

    const overlappingFinanceAndPharmacy = [...pendingRxPatientIds].filter((id) => financePatientIds.has(id));
    const overlappingFinanceAndImaging = [...imagingOrderPatientIds].filter((id) => financePatientIds.has(id));

    const uniqueTransactionIds = new Set(financeTransactions.map((row) => row.id));
    if (uniqueTransactionIds.size !== financeTransactions.length) {
      throw new Error('Duplicate financial transaction IDs detected in finance transaction worklist response');
    }

    report.checks.sync = {
      financeWithPatientContext: financePatientIds.size,
      pendingRxWithPatientContext: pendingRxPatientIds.size,
      imagingOrdersWithPatientContext: imagingOrderPatientIds.size,
      overlapFinancePharmacy: overlappingFinanceAndPharmacy.length,
      overlapFinanceImaging: overlappingFinanceAndImaging.length,
    };
  });
}

main()
  .then(() => {
    summarize();
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`Smoke report saved to: ${reportPath}`);
    console.log(JSON.stringify(report.summary, null, 2));

    if (report.summary.failed > 0) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    report.steps.push({
      label: 'Fatal',
      ok: false,
      method: 'N/A',
      url: 'N/A',
      status: null,
      error: error instanceof Error ? error.message : String(error),
      responsePreview: '',
      critical: true,
    });

    summarize();
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.error('Smoke run failed.');
    console.error(`Report: ${reportPath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
