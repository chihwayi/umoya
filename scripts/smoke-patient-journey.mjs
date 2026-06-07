#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EHR_BASE_URL = (process.env.EHR_BASE_URL || 'http://localhost:3013').replace(/\/+$/, '');
const EHR_API_BASE = `${EHR_BASE_URL}/api`;
const DEMO_BASE_URL = (process.env.DEMO_BASE_URL || 'http://localhost:3004').replace(/\/+$/, '');
const TENANT_ID = process.env.TENANT_ID || 'kids-clinic';

const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'mumu@gmail.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Password1#';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gina@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';

const MEDICAL_AID_NAME = process.env.MEDICAL_AID_NAME || 'cimas';
const DEMO_API_KEY = process.env.DEMO_API_KEY || 'demo-medical-aid-key';

const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

const runStartedAt = new Date();
const stamp = runStartedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.resolve(process.cwd(), 'reports');
const reportPath = path.join(reportDir, `smoke-patient-journey-${stamp}.json`);

const report = {
  startedAt: runStartedAt.toISOString(),
  environment: {
    EHR_BASE_URL,
    EHR_API_BASE,
    DEMO_BASE_URL,
    TENANT_ID,
    MEDICAL_AID_NAME,
  },
  actors: {
    doctorEmail: DOCTOR_EMAIL,
    adminEmail: ADMIN_EMAIL,
  },
  artifacts: {},
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
  const requestHeaders = {
    ...headers,
  };

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
  const apiSteps = report.steps.filter((step) => step.method !== 'N/A');
  const exceptionSteps = report.steps.filter((step) => step.method === 'N/A');
  const total = report.steps.length;
  const passed = report.steps.filter((step) => step.ok).length;
  const failed = total - passed;
  const criticalFailed = exceptionSteps.filter((step) => step.critical).length;

  report.summary = {
    total,
    passed,
    failed,
    criticalFailed,
    apiSteps: apiSteps.length,
    exceptionSteps: exceptionSteps.length,
  };
}

async function main() {
  let doctorToken = '';
  let doctorUserId = '';
  let adminToken = '';

  const uniqueSuffix = `${Date.now()}`.slice(-8);
  const patientSeed = {
    firstName: `Demo${uniqueSuffix.slice(0, 4)}`,
    lastName: `Journey${uniqueSuffix.slice(4)}`,
  };

  let patientId = '';
  let billId = '';
  let financeTransactionId = '';
  let diabetesRegistryId = '';
  let claimId = '';
  let externalClaimId = '';
  let demoMemberNumber = `MED-${uniqueSuffix}`;
  let demoMemberId = '';

  await runStep('Login as doctor', async () => {
    const res = await httpRequest({
      label: 'Doctor login',
      method: 'POST',
      url: `${EHR_API_BASE}/auth/login`,
      tenantId: TENANT_ID,
      json: { email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD },
    });
    doctorToken = res.data?.token;
    doctorUserId = res.data?.user?.id;
    if (!doctorToken || !doctorUserId) throw new Error('Doctor login missing token/user');
    report.artifacts.doctorUserId = doctorUserId;
  });

  await runStep('Login as admin', async () => {
    const res = await httpRequest({
      label: 'Admin login',
      method: 'POST',
      url: `${EHR_API_BASE}/auth/login`,
      tenantId: TENANT_ID,
      json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    adminToken = res.data?.token;
    if (!adminToken) throw new Error('Admin login missing token');
  });

  await runStep('Create demo member (medical aid provider side)', async () => {
    const plans = await httpRequest({
      label: 'Demo plans list',
      method: 'GET',
      url: `${DEMO_BASE_URL}/api/plans`,
      headers: { 'X-API-Key': DEMO_API_KEY },
    });
    const activePlan = (Array.isArray(plans.data) ? plans.data : []).find((row) => row.status === 'active')
      || (Array.isArray(plans.data) ? plans.data[0] : null);
    if (!activePlan?.id) throw new Error('No demo plan available');

    const member = await httpRequest({
      label: 'Demo create member',
      method: 'POST',
      url: `${DEMO_BASE_URL}/api/members`,
      headers: { 'X-API-Key': DEMO_API_KEY },
      json: {
        firstName: patientSeed.firstName,
        lastName: patientSeed.lastName,
        memberNumber: demoMemberNumber,
        planId: activePlan.id,
        status: 'active',
        annualLimit: 1500,
        outpatientLimit: 1000,
        inpatientLimit: 1200,
        perClaimLimit: 700,
      },
      expectedStatus: [201, 200, 409],
    });

    if (member.status === 409) {
      const rows = await httpRequest({
        label: 'Demo members list',
        method: 'GET',
        url: `${DEMO_BASE_URL}/api/members?search=${encodeURIComponent(demoMemberNumber)}`,
        headers: { 'X-API-Key': DEMO_API_KEY },
      });
      const found = (Array.isArray(rows.data) ? rows.data : []).find((row) => row.memberNumber === demoMemberNumber);
      if (!found?.id) throw new Error(`Demo member ${demoMemberNumber} conflict but not fetchable`);
      demoMemberId = found.id;
    } else {
      demoMemberId = member.data?.id;
      demoMemberNumber = member.data?.memberNumber || demoMemberNumber;
    }
    report.artifacts.demoMember = { id: demoMemberId, memberNumber: demoMemberNumber };
  }, { critical: true });

  await runStep('Patient registration', async () => {
    const patientPayload = {
      firstName: patientSeed.firstName,
      lastName: patientSeed.lastName,
      dateOfBirth: '1990-05-15',
      gender: 'female',
      nationalId: `63-${uniqueSuffix}-A-12`,
      phone: `+27${uniqueSuffix}`,
      email: `demo.${uniqueSuffix}@example.com`,
      address: '12 Demo Street',
      city: 'Johannesburg',
      emergencyContactName: 'Demo Contact',
      emergencyContactPhone: `+27${uniqueSuffix}1`,
      emergencyContactRelationship: 'Sibling',
      medicalAidProvider: MEDICAL_AID_NAME,
      medicalAidNumber: demoMemberNumber,
      bloodType: 'O+',
      allergies: 'None',
      medicalHistory: 'Type 2 diabetes follow-up',
    };

    const res = await httpRequest({
      label: 'Create patient',
      method: 'POST',
      url: `${EHR_API_BASE}/patients`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: patientPayload,
      expectedStatus: [201],
    });
    patientId = res.data?.id;
    if (!patientId) throw new Error('Patient ID missing from response');
    report.artifacts.patient = {
      id: patientId,
      patientNumber: res.data?.patientNumber || null,
      name: `${res.data?.firstName || patientPayload.firstName} ${res.data?.lastName || patientPayload.lastName}`,
    };
  });

  await runStep('Vitals capture', async () => {
    const res = await httpRequest({
      label: 'Record vitals',
      method: 'POST',
      url: `${EHR_API_BASE}/vitals`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        recordedBy: doctorUserId,
        bloodPressureSystolic: 152,
        bloodPressureDiastolic: 94,
        heartRate: 97,
        respiratoryRate: 20,
        temperature: 37.1,
        oxygenSaturation: 96,
        bloodGlucose: 13.2,
        weight: 79.4,
        height: 1.69,
        bmi: 27.8,
        painLevel: 1,
        notes: 'Initial triage vitals for chronic-care smoke journey',
      },
      expectedStatus: [201, 200],
    });

    report.artifacts.vitals = {
      id: res.data?.vitals?.id || null,
      cdssInsightsPresent: Boolean(res.data?.cdssInsights),
    };
  });

  await runStep('Diabetes registry create', async () => {
    const res = await httpRequest({
      label: 'Create diabetes registry',
      method: 'POST',
      url: `${EHR_API_BASE}/diabetes/registry`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        diabetesType: 'type2',
        diagnosisDate: '2024-01-15',
        ageAtDiagnosis: 34,
        familyHistory: true,
        carePlan: 'Lifestyle + metformin; quarterly HbA1c review',
        notes: 'Smoke journey enrollment',
      },
      expectedStatus: [201, 200],
    });
    diabetesRegistryId = res.data?.id;
    if (!diabetesRegistryId) throw new Error('Registry ID missing');
    report.artifacts.diabetesRegistryId = diabetesRegistryId;
  });

  await runStep('Diabetes care bundle update', async () => {
    await httpRequest({
      label: 'Create care bundle entry',
      method: 'POST',
      url: `${EHR_API_BASE}/diabetes/registry/${diabetesRegistryId}/care-bundle`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        bundleDate: new Date().toISOString(),
        hba1cChecked: true,
        hba1cValue: 9.4,
        hba1cDate: new Date().toISOString(),
        bloodPressureChecked: true,
        systolicBp: 152,
        diastolicBp: 94,
        footExamChecked: true,
        footExamResult: 'mild neuropathy',
        retinalExamChecked: false,
        renalFunctionChecked: true,
        egfrValue: 81,
        medicationReviewCompleted: true,
      },
      expectedStatus: [201, 200],
    });
  });

  await runStep('Diabetes glucose recordings', async () => {
    await httpRequest({
      label: 'Record glucose fasting',
      method: 'POST',
      url: `${EHR_API_BASE}/diabetes/registry/${diabetesRegistryId}/glucose`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        monitoringType: 'self_monitoring',
        readingType: 'fasting',
        glucoseValue: 12.8,
        glucoseUnit: 'mmol/L',
        notes: 'Morning fasting',
      },
      expectedStatus: [201, 200],
    });

    await httpRequest({
      label: 'Record glucose post meal',
      method: 'POST',
      url: `${EHR_API_BASE}/diabetes/registry/${diabetesRegistryId}/glucose`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        monitoringType: 'self_monitoring',
        readingType: 'post_meal',
        glucoseValue: 14.1,
        glucoseUnit: 'mmol/L',
        mealContext: 'Lunch',
        notes: 'Post-prandial check',
      },
      expectedStatus: [201, 200],
    });
  });

  await runStep('Billing - create bill', async () => {
    const res = await httpRequest({
      label: 'Create bill',
      method: 'POST',
      url: `${EHR_API_BASE}/billing/bills`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        patientId,
        items: [
          {
            code: 'CONS-001',
            description: 'Diabetes follow-up consultation',
            quantity: 1,
            unitPrice: 40,
            totalPrice: 40,
            category: 'consultation',
          },
          {
            code: 'LAB-HBA1C',
            description: 'HbA1c panel',
            quantity: 1,
            unitPrice: 20,
            totalPrice: 20,
            category: 'lab',
          },
        ],
        taxAmount: 0,
        discountAmount: 0,
        notes: 'Diabetes visit with labs',
      },
      expectedStatus: [201, 200],
    });
    billId = res.data?.id;
    if (!billId) throw new Error('Bill ID missing');
    report.artifacts.bill = {
      id: billId,
      billNumber: res.data?.billNumber || null,
      totalAmount: res.data?.totalAmount || null,
    };
  }, { critical: false });

  await runStep('Finance - create transaction', async () => {
    const financePayload = {
      sourceModule: 'billing',
      patientId,
      amount: 60,
      currency: 'USD',
      payerType: 'medical_aid',
      notes: 'Finance posting for diabetes episode',
    };
    if (billId) {
      financePayload.sourceReferenceId = billId;
    }

    const res = await httpRequest({
      label: 'Create finance transaction',
      method: 'POST',
      url: `${EHR_API_BASE}/finance/transactions`,
      token: adminToken,
      tenantId: TENANT_ID,
      json: financePayload,
      expectedStatus: [201, 200],
    });
    financeTransactionId = res.data?.id;
    report.artifacts.financeTransaction = {
      id: financeTransactionId || null,
      paymentStatus: res.data?.payment_status || null,
    };
  });

  await runStep('Medical aid member verification from Umoya', async () => {
    const res = await httpRequest({
      label: 'Verify member',
      method: 'POST',
      url: `${EHR_API_BASE}/medical-aid-api/verify-member`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        medicalAidName: MEDICAL_AID_NAME,
        memberNumber: demoMemberNumber,
      },
      expectedStatus: [201, 200],
    });
    report.artifacts.memberVerification = {
      valid: res.data?.valid ?? null,
      status: res.data?.memberDetails?.status || res.data?.status || null,
    };
  });

  await runStep('Claims - create from bill (linkage check)', async () => {
    if (!billId) {
      report.artifacts.claimFromBill = {
        skipped: true,
        detail: 'Billing record unavailable in this run',
      };
      return;
    }

    const res = await httpRequest({
      label: 'Generate claim from bill',
      method: 'POST',
      url: `${EHR_API_BASE}/claims/from-bill/${billId}`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: {
        medicalAidProvider: MEDICAL_AID_NAME,
        memberNumber: demoMemberNumber,
        additionalData: {
          encounterType: 'outpatient',
          clinicalNotes: 'Diabetes follow-up with poor glycemic control',
        },
      },
      expectedStatus: [201, 200, 400],
    });
    report.artifacts.claimFromBill = {
      statusCode: res.status,
      id: res.data?.id || null,
      detail: res.status === 400 ? (res.data?.message || 'Claim already exists or validation issue') : 'created',
    };
  }, { critical: false });

  await runStep('Claims - create enhanced claim (ready for submit)', async () => {
    const claimPayload = {
      patientId,
      medicalAidProvider: MEDICAL_AID_NAME,
      memberNumber: demoMemberNumber,
      claimAmount: 60,
      diagnosisCodes: ['E11.9', 'R73.9'],
      primaryDiagnosisCode: 'E11.9',
      primaryDiagnosisDescription: 'Type 2 diabetes mellitus without complications',
      claimData: {
        encounterType: 'outpatient',
        clinicalNotes: 'Structured note: diabetes review, counseling done, plan updated',
        serviceCodes: ['CONS-001', 'LAB-HBA1C'],
        procedureCodes: ['LAB-HBA1C'],
      },
    };
    if (billId) {
      claimPayload.billId = billId;
    }

    const res = await httpRequest({
      label: 'Create claim',
      method: 'POST',
      url: `${EHR_API_BASE}/claims`,
      token: doctorToken,
      tenantId: TENANT_ID,
      json: claimPayload,
      expectedStatus: [201, 200],
    });
    claimId = res.data?.id;
    if (!claimId) throw new Error('Claim ID missing');
    report.artifacts.claim = {
      id: claimId,
      claimNumber: res.data?.claimNumber || null,
      status: res.data?.status || null,
    };
  });

  await runStep('Claims - submit enhanced (API)', async () => {
    const res = await httpRequest({
      label: 'Submit enhanced claim',
      method: 'POST',
      url: `${EHR_API_BASE}/claims/${claimId}/submit-enhanced?method=api`,
      token: doctorToken,
      tenantId: TENANT_ID,
      expectedStatus: [201, 200],
    });
    report.artifacts.claimSubmit = {
      status: res.data?.status || null,
      submissionDate: res.data?.submissionDate || null,
    };
  });

  await runStep('Claims - status enhanced poll', async () => {
    const res = await httpRequest({
      label: 'Status enhanced poll',
      method: 'GET',
      url: `${EHR_API_BASE}/claims/${claimId}/status-enhanced`,
      token: doctorToken,
      tenantId: TENANT_ID,
      expectedStatus: [200],
    });
    report.artifacts.claimStatusAfterPoll = {
      status: res.data?.claim?.status || null,
      approvedAmount: res.data?.claim?.approvedAmount || null,
      historyCount: Array.isArray(res.data?.statusHistory) ? res.data.statusHistory.length : 0,
    };
  });

  await runStep('Claims - simulate provider suspended then paid', async () => {
    const listRes = await httpRequest({
      label: 'Demo list claims by member',
      method: 'GET',
      url: `${DEMO_BASE_URL}/api/claims?memberNumber=${encodeURIComponent(demoMemberNumber)}`,
      headers: { 'X-API-Key': DEMO_API_KEY },
      expectedStatus: [200],
    });

    const claims = Array.isArray(listRes.data) ? listRes.data : [];
    const latest = claims.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
    if (!latest?.externalClaimId) {
      throw new Error('No provider claim found to simulate status changes');
    }
    externalClaimId = latest.externalClaimId;
    report.artifacts.externalClaimId = externalClaimId;

    await httpRequest({
      label: 'Demo set claim suspended',
      method: 'PUT',
      url: `${DEMO_BASE_URL}/api/claims/${encodeURIComponent(externalClaimId)}/status`,
      headers: { 'X-API-Key': DEMO_API_KEY },
      json: {
        status: 'suspended',
        note: 'Suspended for manual review',
      },
      expectedStatus: [200],
    });

    const suspendedPoll = await httpRequest({
      label: 'Poll after suspended',
      method: 'GET',
      url: `${EHR_API_BASE}/claims/${claimId}/status-enhanced`,
      token: doctorToken,
      tenantId: TENANT_ID,
      expectedStatus: [200],
    });

    await httpRequest({
      label: 'Demo set claim paid',
      method: 'PUT',
      url: `${DEMO_BASE_URL}/api/claims/${encodeURIComponent(externalClaimId)}/status`,
      headers: { 'X-API-Key': DEMO_API_KEY },
      json: {
        status: 'paid',
        approvedAmount: 58,
        paidAmount: 58,
        note: 'Payment released',
      },
      expectedStatus: [200],
    });

    const paidPoll = await httpRequest({
      label: 'Poll after paid',
      method: 'GET',
      url: `${EHR_API_BASE}/claims/${claimId}/status-enhanced`,
      token: doctorToken,
      tenantId: TENANT_ID,
      expectedStatus: [200],
    });

    report.artifacts.claimStatusTransitions = {
      suspendedMappedStatus: suspendedPoll.data?.claim?.status || null,
      paidMappedStatus: paidPoll.data?.claim?.status || null,
      paidAmount: paidPoll.data?.claim?.approvedAmount || null,
    };
  }, { critical: false });

  const moduleChecks = [
    { key: 'mar', url: `${EHR_API_BASE}/bcma/mar/operational-brief` },
    { key: 'bloodBank', url: `${EHR_API_BASE}/blood-bank/operational-brief` },
    { key: 'sepsis', url: `${EHR_API_BASE}/sepsis/operational-brief` },
    { key: 'infectionControl', url: `${EHR_API_BASE}/infection-control/operational-brief` },
    { key: 'cdi', url: `${EHR_API_BASE}/cdi/queries/brief/${doctorUserId}` },
    { key: 'revenueCycle', url: `${EHR_API_BASE}/revenue-cycle/operational-brief?doctorId=${doctorUserId}` },
    { key: 'populationHealth', url: `${EHR_API_BASE}/population-health/operational-brief` },
  ];

  report.artifacts.moduleChecks = {};

  for (const module of moduleChecks) {
    await runStep(`Module operational brief: ${module.key}`, async () => {
      const res = await httpRequest({
        label: `Operational brief ${module.key}`,
        method: 'GET',
        url: module.url,
        token: doctorToken,
        tenantId: TENANT_ID,
        expectedStatus: [200, 500, 504],
      });

      if (res.status !== 200) {
        report.artifacts.moduleChecks[module.key] = {
          ok: false,
          statusCode: res.status,
          message: res.data?.message || res.data?.error || 'non-200 response',
        };
      } else {
        report.artifacts.moduleChecks[module.key] = {
          ok: true,
          statusCode: res.status,
          hasSummary: Boolean(res.data?.summary || res.data?.brief || res.data?.metrics),
        };
      }
    }, { critical: false });
  }

  summarize();
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('Smoke patient journey complete.');
  console.log(`Report: ${reportPath}`);
  console.log(
    `Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed`,
  );

  if (report.summary.criticalFailed > 0) {
    process.exitCode = 2;
  } else if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  report.finishedAt = new Date().toISOString();
  report.fatalError = err instanceof Error ? err.message : String(err);
  summarize();
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error('Smoke patient journey failed.');
  console.error(report.fatalError);
  console.error(`Report: ${reportPath}`);
  process.exit(3);
});
